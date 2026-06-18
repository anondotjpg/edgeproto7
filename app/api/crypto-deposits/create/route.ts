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
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string | null;
};

const INVOICE_EXPIRY_MS = 10 * 60 * 1000;

const RELAY_QUOTE_AMOUNT_MULTIPLIER = Number(
  process.env.RELAY_QUOTE_AMOUNT_MULTIPLIER ?? "0.01",
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
      profit_target_percent: PROFIT_TARGET_PERCENT,
      daily_drawdown_percent: DAILY_LOSS_PERCENT,
      total_drawdown_percent: TOTAL_LOSS_PERCENT,
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