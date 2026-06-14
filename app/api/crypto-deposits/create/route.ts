import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";
import { validatePromoCode } from "@/lib/promo-codes";
import {
  CHAIN_CONFIG,
  DESTINATION_CONFIG,
  type DepositChain,
  getRelayRefundTo,
  getRelayUserAddress,
  isDepositChain,
  usdcAtomicToDisplay,
} from "@/lib/crypto-deposits";

type CreateDepositBody = {
  planKey?: PlanKey;
  chain?: DepositChain;
  promoCode?: string | null;
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string | null;
};

type RelayQuoteResult = {
  quote: Record<string, unknown>;
  requestId: string;
  depositAddress: string;
  originAmountAtomic: string;
  originAmountDisplay: string;
};

const RELAY_API_BASE = process.env.RELAY_API_BASE ?? "https://api.relay.link";
const INVOICE_EXPIRY_MS = 10 * 60 * 1000;

const RELAY_QUOTE_AMOUNT_MULTIPLIER = Number(
  process.env.RELAY_QUOTE_AMOUNT_MULTIPLIER ?? "0.01",
);

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
  expected_amount_display,
  expected_destination_amount_display,
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
  final_amount_cents
`;

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
  const discounted = Math.round(finalCents * RELAY_QUOTE_AMOUNT_MULTIPLIER);
  return Math.max(1, discounted);
}

function centsToUsdcAtomic(cents: number) {
  return BigInt(cents) * BigInt(10000);
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function findDepositAddress(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDepositAddress(item);
      if (found) return found;
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  const direct =
    readString(record.depositAddress) ??
    readString(record.deposit_address) ??
    readString(record.address);

  if (direct) return direct;

  for (const nested of Object.values(record)) {
    const found = findDepositAddress(nested);
    if (found) return found;
  }

  return null;
}

function findRequestId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRequestId(item);
      if (found) return found;
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  const direct =
    readString(record.requestId) ??
    readString(record.request_id) ??
    readString(record.id);

  if (direct) return direct;

  for (const nested of Object.values(record)) {
    const found = findRequestId(nested);
    if (found) return found;
  }

  return null;
}

function getCurrencyAddress(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;

  const currency = asRecord(record.currency);
  if (currency) {
    return readString(currency.address) ?? readString(currency.currency);
  }

  return readString(record.currency) ?? readString(record.address);
}

function getCurrencyChainId(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;

  const currency = asRecord(record.currency);
  const chainValue =
    currency?.chainId ??
    currency?.chain_id ??
    record.chainId ??
    record.chain_id;

  const parsed = Number(chainValue);

  return Number.isFinite(parsed) ? parsed : null;
}

function getAmountFields(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;

  const amountAtomic =
    readString(record.amount) ??
    readString(record.amountAtomic) ??
    readString(record.amount_atomic) ??
    readString(record.rawAmount);

  const amountDisplay =
    readString(record.amountFormatted) ??
    readString(record.amount_formatted) ??
    readString(record.amountDisplay) ??
    readString(record.amount_display);

  if (!amountAtomic && !amountDisplay) return null;

  return {
    amountAtomic,
    amountDisplay,
  };
}

function findOriginAmount({
  value,
  originCurrency,
  originChainId,
}: {
  value: unknown;
  originCurrency: string;
  originChainId: number;
}): { amountAtomic: string; amountDisplay: string } | null {
  const record = asRecord(value);

  if (!record) return null;

  const details = asRecord(record.details);
  const directCurrencyIn = asRecord(details?.currencyIn ?? record.currencyIn);

  if (directCurrencyIn) {
    const fields = getAmountFields(directCurrencyIn);

    if (fields?.amountAtomic && fields.amountDisplay) {
      return {
        amountAtomic: fields.amountAtomic,
        amountDisplay: fields.amountDisplay,
      };
    }
  }

  const currencyAddress = getCurrencyAddress(record);
  const currencyChainId = getCurrencyChainId(record);
  const fields = getAmountFields(record);

  if (
    fields?.amountAtomic &&
    fields.amountDisplay &&
    currencyAddress?.toLowerCase() === originCurrency.toLowerCase() &&
    currencyChainId === originChainId
  ) {
    return {
      amountAtomic: fields.amountAtomic,
      amountDisplay: fields.amountDisplay,
    };
  }

  for (const nested of Object.values(record)) {
    if (!nested || typeof nested !== "object") continue;

    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = findOriginAmount({
          value: item,
          originCurrency,
          originChainId,
        });

        if (found) return found;
      }

      continue;
    }

    const found = findOriginAmount({
      value: nested,
      originCurrency,
      originChainId,
    });

    if (found) return found;
  }

  return null;
}

function getRelayErrorMessage(data: unknown) {
  const record = asRecord(data);

  return (
    readString(record?.message) ??
    readString(record?.error) ??
    readString(record?.details) ??
    "Relay quote failed."
  );
}

async function readRelayJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Relay returned non-JSON response. Status: ${response.status}. ${text.slice(
        0,
        160,
      )}`,
    );
  }
}

async function createRelayDepositQuote({
  chain,
  destinationAmountAtomic,
}: {
  chain: DepositChain;
  destinationAmountAtomic: bigint;
}): Promise<RelayQuoteResult> {
  const origin = CHAIN_CONFIG[chain];
  const relayUserAddress = getRelayUserAddress(chain);
  const refundTo = getRelayRefundTo(chain);

  const body = {
    user: relayUserAddress,
    recipient: DESTINATION_CONFIG.recipient,

    originChainId: origin.relayChainId,
    originCurrency: origin.relayOriginCurrency,

    destinationChainId: DESTINATION_CONFIG.chainId,
    destinationCurrency: DESTINATION_CONFIG.currency,

    amount: destinationAmountAtomic.toString(),
    tradeType: "EXACT_OUTPUT",

    useDepositAddress: true,
    strict: true,
    refundTo,
    referrer: "edge",
  };

  const response = await fetch(`${RELAY_API_BASE}/quote/v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await readRelayJson(response);

  if (!response.ok) {
    throw new Error(getRelayErrorMessage(data));
  }

  const quote = (data ?? {}) as Record<string, unknown>;
  const requestId = findRequestId(quote);
  const depositAddress = findDepositAddress(quote);
  const originAmount = findOriginAmount({
    value: quote,
    originCurrency: origin.relayOriginCurrency,
    originChainId: origin.relayChainId,
  });

  if (!requestId) {
    throw new Error("Relay quote did not return a request ID.");
  }

  if (!depositAddress) {
    throw new Error("Relay quote did not return a deposit address.");
  }

  if (!originAmount) {
    throw new Error("Relay quote did not return a readable payment amount.");
  }

  return {
    quote,
    requestId,
    depositAddress,
    originAmountAtomic: originAmount.amountAtomic,
    originAmountDisplay: originAmount.amountDisplay,
  };
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
  promo,
}: {
  userId: string;
  planKey: PlanKey;
  planSize: number;
  chain: DepositChain;
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

      provider: "promo",
      chain,
      asset: origin.asset,

      deposit_address: "PROMO_CODE",
      relay_deposit_address: null,
      relay_request_id: null,
      relay_status: "success",

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

  const { data: account, error: accountError } = await supabaseAdmin
    .from("challenge_accounts")
    .insert({
      user_id: userId,
      plan_key: planKey,
      plan_size: planSize,
      one_time_fee: 0,
      status: "active",
      starting_balance: planSize,
      current_balance: planSize,
      reserved_risk: 0,
      max_risk_amount: maxRiskAmount,
      daily_loss_limit_amount: dailyLossLimitAmount,
      total_loss_limit_amount: totalLossLimitAmount,
    })
    .select("id")
    .single();

  if (accountError) {
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

    throw accountError;
  }

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      credited_account_id: account.id,
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
        { error: promo.message ?? "Invalid promo code." },
        { status: 400 },
      );
    }

    const finalCents = promo.finalCents;
    const finalFeeAmount = centsToDollars(finalCents);

    if (finalCents === 0) {
      const invoice = await createFreePromoInvoice({
        userId,
        planKey,
        planSize,
        chain,
        promo: {
          code: promo.code,
          promoCodeId: promo.promoCodeId,
          subtotalCents: promo.subtotalCents,
          discountCents: promo.discountCents,
          finalCents: promo.finalCents,
        },
      });

      return NextResponse.json({
        invoice,
        promo: {
          code: promo.code,
          subtotalCents: promo.subtotalCents,
          discountCents: promo.discountCents,
          finalCents: promo.finalCents,
        },
      });
    }

    const quoteCents = getQuoteCents(finalCents);
    const destinationAmountAtomic = centsToUsdcAtomic(quoteCents);
    const expectedDestinationAmountDisplay = usdcAtomicToDisplay(
      destinationAmountAtomic,
    );

    const relayQuote = await createRelayDepositQuote({
      chain,
      destinationAmountAtomic,
    });

    const { dailyLossLimitAmount, totalLossLimitAmount, maxRiskAmount } =
      getAccountRuleAmounts(planSize);

    const expiresAt = new Date(Date.now() + INVOICE_EXPIRY_MS);
    const origin = CHAIN_CONFIG[chain];

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .insert({
        user_id: userId,
        plan_key: planKey,

        provider: "relay",
        chain,
        asset: origin.asset,

        deposit_address: relayQuote.depositAddress,
        relay_deposit_address: relayQuote.depositAddress,
        relay_request_id: relayQuote.requestId,
        relay_status: "waiting",

        relay_origin_chain_id: origin.relayChainId,
        relay_origin_currency: origin.relayOriginCurrency,
        relay_destination_chain_id: DESTINATION_CONFIG.chainId,
        relay_destination_currency: DESTINATION_CONFIG.currency,
        relay_quote: relayQuote.quote,

        expected_from_address: null,
        expected_amount_atomic: relayQuote.originAmountAtomic,
        expected_amount_display: relayQuote.originAmountDisplay,

        expected_destination_amount_atomic: destinationAmountAtomic.toString(),
        expected_destination_amount_display: expectedDestinationAmountDisplay,
        destination_address: DESTINATION_CONFIG.recipient,

        status: "pending",
        expires_at: expiresAt.toISOString(),

        account_starting_balance: planSize,
        account_max_risk_amount: maxRiskAmount,
        account_daily_loss_limit_amount: dailyLossLimitAmount,
        account_total_loss_limit_amount: totalLossLimitAmount,
        account_profit_target_percent: PROFIT_TARGET_PERCENT,

        one_time_fee: finalFeeAmount,

        promo_code_id: promo.promoCodeId,
        promo_code: promo.code,
        subtotal_amount_cents: promo.subtotalCents,
        discount_amount_cents: promo.discountCents,
        final_amount_cents: promo.finalCents,
      })
      .select(INVOICE_SELECT)
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    if (promo.promoCodeId && promo.discountCents > 0) {
      const { error: redemptionError } = await supabaseAdmin
        .from("promo_redemptions")
        .insert({
          promo_code_id: promo.promoCodeId,
          user_id: userId,
          invoice_id: invoice.id,
          status: "reserved",
          plan_key: planKey,
          subtotal_cents: promo.subtotalCents,
          discount_cents: promo.discountCents,
          final_cents: promo.finalCents,
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
        code: promo.code,
        subtotalCents: promo.subtotalCents,
        discountCents: promo.discountCents,
        finalCents: promo.finalCents,
      },
    });
  } catch (error) {
    console.error("[crypto-deposits/create] error", error);

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