import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";
import { validatePromoCode } from "@/lib/promo-codes";
import { createRelayDepositQuote } from "@/lib/relay";
import {
  CHAIN_CONFIG,
  DESTINATION_CONFIG,
  type DepositChain,
  centsToUsdcAtomic,
  isDepositChain,
  makeEdgeMinAcceptableUsdcAtomic,
  usdcAtomicToDisplay,
} from "@/lib/crypto-deposits";

type CreateDepositBody = {
  planKey?: PlanKey;
  chain?: DepositChain;
  promoCode?: string | null;
  accountQuantity?: number;
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string | null;
};

const SOL_ETH_INVOICE_EXPIRY_MS = 10 * 60 * 1000;
const BTC_INVOICE_EXPIRY_MS = 60 * 60 * 1000;
const MAX_OPEN_RELAY_DEPOSITS = 2;
const MAX_ACCOUNT_QUANTITY = 5;

const RELAY_QUOTE_AMOUNT_MULTIPLIER = Number(
  process.env.RELAY_QUOTE_AMOUNT_MULTIPLIER ?? "1",
);

const RELAY_MIN_FOLLOWS_QUOTE_MULTIPLIER =
  process.env.RELAY_MIN_FOLLOWS_QUOTE_MULTIPLIER !== "false";

const PROFIT_TARGET_PERCENT = 25;
const DAILY_LOSS_PERCENT = 2;
const TOTAL_LOSS_PERCENT = 5;
const MAX_RISK_PER_TRADE_PERCENT = 5;

const INVOICE_SELECT = `
  id,
  provider,
  chain,
  asset,
  deposit_address,
  relay_deposit_address,
  relay_request_id,
  relay_status,
  relay_trade_type,
  expected_amount_display,
  expected_destination_amount_display,
  quoted_destination_amount_atomic,
  quoted_destination_amount_display,
  edge_min_destination_amount_atomic,
  edge_min_destination_amount_display,
  received_destination_amount_atomic,
  received_destination_amount_display,
  destination_address,
  status,
  expires_at,
  tx_hash,
  confirmations,
  credited_account_id,
  relay_in_tx_hashes,
  relay_out_tx_hashes,
  promo_code,
  subtotal_amount_cents,
  discount_amount_cents,
  final_amount_cents,
  account_quantity
`;

class OpenDepositLimitError extends Error {
  openDepositCount: number;

  constructor(openDepositCount: number) {
    super(
      "You already have two open deposits. Complete one or wait for one to expire before starting another.",
    );
    this.name = "OpenDepositLimitError";
    this.openDepositCount = openDepositCount;
  }
}

function getInvoiceExpiryMs(chain: DepositChain) {
  if (chain === "bitcoin") {
    return BTC_INVOICE_EXPIRY_MS;
  }

  return SOL_ETH_INVOICE_EXPIRY_MS;
}

function isOpenDepositLimitDbError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return message.toLowerCase().includes("two open deposits");
}

function openDepositLimitResponse(extra?: {
  openDepositCount?: number;
  maxOpenDeposits?: number;
}) {
  return NextResponse.json(
    {
      code: "OPEN_DEPOSIT_LIMIT",
      error:
        "You already have two open deposits. Complete one or wait for one to expire before starting another.",
      toastTitle: "Two deposits already open",
      toastDescription:
        "Complete one deposit or wait for a quote to expire before starting another.",
      maxOpenDeposits: MAX_OPEN_RELAY_DEPOSITS,
      ...extra,
    },
    { status: 409 },
  );
}

function parseAccountQuantity(value: unknown) {
  if (typeof value === "undefined" || value === null) return 1;

  const quantity = Number(value);

  if (!Number.isInteger(quantity)) return null;
  if (quantity < 1 || quantity > MAX_ACCOUNT_QUANTITY) return null;

  return quantity;
}

function accountQuantityErrorResponse() {
  return NextResponse.json(
    {
      code: "INVALID_ACCOUNT_QUANTITY",
      error: `Choose between 1 and ${MAX_ACCOUNT_QUANTITY} accounts.`,
      toastTitle: "Invalid quantity",
      toastDescription: `You can buy between 1 and ${MAX_ACCOUNT_QUANTITY} accounts at once.`,
      maxAccountQuantity: MAX_ACCOUNT_QUANTITY,
    },
    { status: 400 },
  );
}

function multiplyPromoForQuantity({
  promo,
  accountQuantity,
}: {
  promo: {
    code: string | null;
    promoCodeId: string | null;
    subtotalCents: number;
    discountCents: number;
    finalCents: number;
  };
  accountQuantity: number;
}) {
  return {
    code: promo.code,
    promoCodeId: promo.promoCodeId,
    subtotalCents: promo.subtotalCents * accountQuantity,
    discountCents: promo.discountCents * accountQuantity,
    finalCents: promo.finalCents * accountQuantity,
  };
}

function getAccountRuleAmounts(planSize: number) {
  return {
    dailyLossLimitAmount: Math.round(planSize * (DAILY_LOSS_PERCENT / 100)),
    totalLossLimitAmount: Math.round(planSize * (TOTAL_LOSS_PERCENT / 100)),
    maxRiskAmount: Math.round(planSize * (MAX_RISK_PER_TRADE_PERCENT / 100)),
  };
}

function centsToDollars(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function getQuoteCents(finalCents: number) {
  const multiplier = Number.isFinite(RELAY_QUOTE_AMOUNT_MULTIPLIER)
    ? RELAY_QUOTE_AMOUNT_MULTIPLIER
    : 1;

  const discounted = Math.round(finalCents * multiplier);

  return Math.max(1, discounted);
}

function getEdgeMinBaseCents({
  finalCents,
  quoteCents,
}: {
  finalCents: number;
  quoteCents: number;
}) {
  return RELAY_MIN_FOLLOWS_QUOTE_MULTIPLIER ? quoteCents : finalCents;
}

async function expireStaleRelayDepositInvoices(userId: string) {
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .update({
      status: "expired",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("provider", "relay")
    .eq("status", "pending")
    .lt("expires_at", nowIso);

  if (error) {
    throw error;
  }
}

type OpenRelayDepositRow = {
  id: string;
  status: string | null;
  expires_at: string | null;
};

async function getOpenRelayDepositCount(userId: string) {
  const nowMs = Date.now();

  const { data, error } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .select("id, status, expires_at")
    .eq("user_id", userId)
    .eq("provider", "relay")
    .in("status", ["pending", "processing"])
    .returns<OpenRelayDepositRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).filter((invoice) => {
    if (invoice.status === "processing") return true;
    if (invoice.status !== "pending") return false;
    if (!invoice.expires_at) return true;

    const expiresAtMs = new Date(invoice.expires_at).getTime();

    if (!Number.isFinite(expiresAtMs)) return true;

    return expiresAtMs > nowMs;
  }).length;
}

async function assertCanCreateRelayDeposit(userId: string) {
  await expireStaleRelayDepositInvoices(userId);

  const openDepositCount = await getOpenRelayDepositCount(userId);

  if (openDepositCount >= MAX_OPEN_RELAY_DEPOSITS) {
    throw new OpenDepositLimitError(openDepositCount);
  }
}

async function upsertUser({
  privyUserId,
  email,
  walletAddress,
}: {
  privyUserId: string;
  email: string | null | undefined;
  walletAddress: string | null | undefined;
}) {
  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (existingUserError) {
    throw existingUserError;
  }

  if (existingUser?.id) {
    const { error: updateUserError } = await supabaseAdmin
      .from("users")
      .update({
        email: email ?? null,
        wallet_address: walletAddress ?? null,
      })
      .eq("id", existingUser.id);

    if (updateUserError) {
      throw updateUserError;
    }

    return existingUser.id as string;
  }

  const { data: insertedUser, error: insertUserError } = await supabaseAdmin
    .from("users")
    .insert({
      privy_user_id: privyUserId,
      email: email ?? null,
      wallet_address: walletAddress ?? null,
    })
    .select("id")
    .single();

  if (insertUserError) {
    throw insertUserError;
  }

  return insertedUser.id as string;
}

async function createFreePromoInvoice({
  userId,
  planKey,
  planSize,
  chain,
  accountQuantity,
  promo,
}: {
  userId: string;
  planKey: PlanKey;
  planSize: number;
  chain: DepositChain;
  accountQuantity: number;
  promo: {
    code: string | null;
    promoCodeId: string | null;
    subtotalCents: number;
    discountCents: number;
    finalCents: number;
  };
}) {
  const origin = CHAIN_CONFIG[chain];
  const { dailyLossLimitAmount, totalLossLimitAmount, maxRiskAmount } =
    getAccountRuleAmounts(planSize);

  const nowIso = new Date().toISOString();

  const { data: invoiceDraft, error: invoiceDraftError } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .insert({
      user_id: userId,
      plan_key: planKey,
      account_quantity: accountQuantity,

      provider: "promo",
      chain,
      asset: origin.asset,

      deposit_address: "PROMO_CODE",
      relay_deposit_address: null,
      relay_request_id: null,
      relay_status: "success",
      relay_trade_type: null,

      relay_origin_chain_id: origin.relayChainId,
      relay_origin_currency: origin.relayOriginCurrency,
      relay_destination_chain_id: DESTINATION_CONFIG.chainId,
      relay_destination_currency: DESTINATION_CONFIG.currency,
      relay_quote: null,

      expected_from_address: null,
      expected_amount_atomic: "0",
      expected_amount_display: "0",

      expected_destination_amount_atomic: "0",
      expected_destination_amount_display: "0",
      quoted_destination_amount_atomic: "0",
      quoted_destination_amount_display: "0",
      edge_min_destination_amount_atomic: "0",
      edge_min_destination_amount_display: "0",
      received_destination_amount_atomic: "0",
      received_destination_amount_display: "0",
      destination_address: DESTINATION_CONFIG.recipient,

      status: "pending",
      expires_at: nowIso,

      account_starting_balance: planSize,
      account_max_risk_amount: maxRiskAmount,
      account_daily_loss_limit_amount: dailyLossLimitAmount,
      account_total_loss_limit_amount: totalLossLimitAmount,
      account_profit_target_percent: PROFIT_TARGET_PERCENT,

      one_time_fee: 0,

      promo_code_id: promo.promoCodeId,
      promo_code: promo.code,
      subtotal_amount_cents: promo.subtotalCents,
      discount_amount_cents: promo.discountCents,
      final_amount_cents: promo.finalCents,
    })
    .select("id")
    .single();

  if (invoiceDraftError) {
    throw invoiceDraftError;
  }

  if (promo.promoCodeId && promo.discountCents > 0) {
    const { error: redemptionError } = await supabaseAdmin
      .from("promo_redemptions")
      .insert({
        promo_code_id: promo.promoCodeId,
        user_id: userId,
        invoice_id: invoiceDraft.id,
        status: "redeemed",
        plan_key: planKey,
        subtotal_cents: promo.subtotalCents,
        discount_cents: promo.discountCents,
        final_cents: promo.finalCents,
        redeemed_at: nowIso,
      });

    if (redemptionError) {
      await supabaseAdmin
        .from("crypto_deposit_invoices")
        .update({
          status: "invalid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceDraft.id);

      throw redemptionError;
    }
  }

  const accountsToInsert = Array.from({ length: accountQuantity }, () => ({
    user_id: userId,
    plan_key: planKey,
    plan_size: planSize,
    one_time_fee: 0,
    status: "active",
    starting_balance: planSize,
    current_balance: planSize,
    reserved_risk: 0,
    profit_target_percent: PROFIT_TARGET_PERCENT,
    daily_drawdown_percent: DAILY_LOSS_PERCENT,
    total_drawdown_percent: TOTAL_LOSS_PERCENT,
    max_risk_amount: maxRiskAmount,
    daily_loss_limit_amount: dailyLossLimitAmount,
    total_loss_limit_amount: totalLossLimitAmount,
  }));

  const { data: accounts, error: accountError } = await supabaseAdmin
    .from("challenge_accounts")
    .insert(accountsToInsert)
    .select("id");

  if (accountError || !accounts?.length) {
    await supabaseAdmin
      .from("crypto_deposit_invoices")
      .update({
        status: "invalid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceDraft.id);

    await supabaseAdmin
      .from("promo_redemptions")
      .update({ status: "expired" })
      .eq("invoice_id", invoiceDraft.id)
      .eq("status", "redeemed");

    if (accountError) throw accountError;

    throw new Error("Unable to create challenge accounts.");
  }

  const firstAccountId = accounts[0].id as string;

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      credited_account_id: firstAccountId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceDraft.id)
    .select(INVOICE_SELECT)
    .single();

  if (invoiceError) {
    throw invoiceError;
  }

  return invoice;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDepositBody;

    const planKey = body.planKey;
    const chain = body.chain;
    const promoCode =
      typeof body.promoCode === "string" ? body.promoCode : null;
    const privyUserId =
      typeof body.privyUserId === "string" ? body.privyUserId : null;

    if (!planKey || !(planKey in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid plan selected." },
        { status: 400 },
      );
    }

    if (!isDepositChain(chain)) {
      return NextResponse.json(
        { error: "Invalid payment method." },
        { status: 400 },
      );
    }

    if (!privyUserId) {
      return NextResponse.json(
        { error: "Missing Privy user ID." },
        { status: 400 },
      );
    }

    const selectedPlan = PLAN_CONFIG[planKey];
    const planSize = Number(selectedPlan.planKey);

    if (!Number.isFinite(planSize) || planSize <= 0) {
      return NextResponse.json(
        { error: "Invalid plan size." },
        { status: 400 },
      );
    }

    const accountQuantity = parseAccountQuantity(body.accountQuantity);

    if (!accountQuantity) {
      return accountQuantityErrorResponse();
    }

    const userId = await upsertUser({
      privyUserId,
      email: body.email,
      walletAddress: body.walletAddress,
    });

    const promo = await validatePromoCode({
      code: promoCode,
      planKey,
      userId,
    });

    if (!promo.valid) {
      return NextResponse.json(
        {
          code: "PROMO_INVALID",
          error: promo.message ?? "Invalid promo code.",
          toastTitle: "Promo code not applied",
          toastDescription: promo.message ?? "Invalid promo code.",
        },
        { status: 400 },
      );
    }

    const purchasePromo = multiplyPromoForQuantity({
      promo: {
        code: promo.code,
        promoCodeId: promo.promoCodeId,
        subtotalCents: promo.subtotalCents,
        discountCents: promo.discountCents,
        finalCents: promo.finalCents,
      },
      accountQuantity,
    });

    const finalCents = purchasePromo.finalCents;
    const finalFeeAmount = centsToDollars(finalCents);

    if (finalCents === 0) {
      const invoice = await createFreePromoInvoice({
        userId,
        planKey,
        planSize,
        chain,
        accountQuantity,
        promo: purchasePromo,
      });

      return NextResponse.json({
        invoice,
        promo: {
          code: purchasePromo.code,
          subtotalCents: purchasePromo.subtotalCents,
          discountCents: purchasePromo.discountCents,
          finalCents: purchasePromo.finalCents,
        },
      });
    }

    await assertCanCreateRelayDeposit(userId);

    const quoteCents = getQuoteCents(finalCents);
    const destinationAmountAtomic = centsToUsdcAtomic(quoteCents);
    const expectedDestinationAmountDisplay = usdcAtomicToDisplay(
      destinationAmountAtomic,
    );

    const edgeMinBaseCents = getEdgeMinBaseCents({
      finalCents,
      quoteCents,
    });

    const edgeMinDestinationAmountAtomic = makeEdgeMinAcceptableUsdcAtomic({
      planKey,
      finalCents: edgeMinBaseCents,
    });

    const edgeMinDestinationAmountDisplay = usdcAtomicToDisplay(
      edgeMinDestinationAmountAtomic,
    );

    const relayQuote = await createRelayDepositQuote({
      chain,
      destinationAmountAtomic,
    });

    const { dailyLossLimitAmount, totalLossLimitAmount, maxRiskAmount } =
      getAccountRuleAmounts(planSize);

    const expiresAt = new Date(Date.now() + getInvoiceExpiryMs(chain));
    const origin = CHAIN_CONFIG[chain];

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .insert({
        user_id: userId,
        plan_key: planKey,
        account_quantity: accountQuantity,

        provider: "relay",
        chain,
        asset: origin.asset,

        deposit_address: relayQuote.depositAddress,
        relay_deposit_address: relayQuote.depositAddress,
        relay_request_id: relayQuote.requestId,
        relay_status: "waiting",
        relay_trade_type: relayQuote.tradeType,

        relay_origin_chain_id: origin.relayChainId,
        relay_origin_currency: origin.relayOriginCurrency,
        relay_destination_chain_id: DESTINATION_CONFIG.chainId,
        relay_destination_currency: DESTINATION_CONFIG.currency,
        relay_quote: relayQuote.quote,

        expected_from_address: null,
        expected_amount_atomic: relayQuote.amountInAtomic,
        expected_amount_display: relayQuote.amountInDisplay,

        expected_destination_amount_atomic: destinationAmountAtomic.toString(),
        expected_destination_amount_display: expectedDestinationAmountDisplay,
        quoted_destination_amount_atomic: relayQuote.quotedAmountOutAtomic,
        quoted_destination_amount_display: relayQuote.quotedAmountOutDisplay,
        edge_min_destination_amount_atomic:
          edgeMinDestinationAmountAtomic.toString(),
        edge_min_destination_amount_display: edgeMinDestinationAmountDisplay,
        received_destination_amount_atomic: null,
        received_destination_amount_display: null,
        destination_address: DESTINATION_CONFIG.recipient,

        status: "pending",
        expires_at: expiresAt.toISOString(),

        account_starting_balance: planSize,
        account_max_risk_amount: maxRiskAmount,
        account_daily_loss_limit_amount: dailyLossLimitAmount,
        account_total_loss_limit_amount: totalLossLimitAmount,
        account_profit_target_percent: PROFIT_TARGET_PERCENT,

        one_time_fee: finalFeeAmount,

        promo_code_id: purchasePromo.promoCodeId,
        promo_code: purchasePromo.code,
        subtotal_amount_cents: purchasePromo.subtotalCents,
        discount_amount_cents: purchasePromo.discountCents,
        final_amount_cents: purchasePromo.finalCents,
      })
      .select(INVOICE_SELECT)
      .single();

    if (invoiceError) {
      if (isOpenDepositLimitDbError(invoiceError)) {
        return openDepositLimitResponse();
      }

      throw invoiceError;
    }

    if (purchasePromo.promoCodeId && purchasePromo.discountCents > 0) {
      const { error: redemptionError } = await supabaseAdmin
        .from("promo_redemptions")
        .insert({
          promo_code_id: purchasePromo.promoCodeId,
          user_id: userId,
          invoice_id: invoice.id,
          status: "reserved",
          plan_key: planKey,
          subtotal_cents: purchasePromo.subtotalCents,
          discount_cents: purchasePromo.discountCents,
          final_cents: purchasePromo.finalCents,
        });

      if (redemptionError) {
        await supabaseAdmin
          .from("crypto_deposit_invoices")
          .update({
            status: "invalid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id);

        throw redemptionError;
      }
    }

    return NextResponse.json({
      invoice,
      promo: {
        code: purchasePromo.code,
        subtotalCents: purchasePromo.subtotalCents,
        discountCents: purchasePromo.discountCents,
        finalCents: purchasePromo.finalCents,
      },
    });
  } catch (error) {
    console.error("[crypto-deposits/create] error", error);

    if (error instanceof OpenDepositLimitError) {
      return openDepositLimitResponse({
        openDepositCount: error.openDepositCount,
        maxOpenDeposits: MAX_OPEN_RELAY_DEPOSITS,
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create deposit invoice.",
      },
      { status: 500 },
    );
  }
}