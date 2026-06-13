import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";
import {
  DESTINATION_CONFIG,
  type DepositChain,
  getDepositAsset,
  getPlanKeyValue,
  isDepositChain,
  makePlanUsdcAmountAtomic,
  usdcAtomicToDisplay,
} from "@/lib/crypto-deposits";
import { createRelayDepositQuote } from "@/lib/relay";

type CreateDepositBody = {
  planKey?: PlanKey;
  chain?: DepositChain;
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string | null;
};

const PROFIT_TARGET_PERCENT = 25;
const DAILY_DRAWDOWN_PERCENT = 2;
const TOTAL_DRAWDOWN_PERCENT = 5;
const MAX_RISK_PER_TRADE_PERCENT = 5;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDepositBody;

    const { planKey, chain, privyUserId, email, walletAddress } = body;

    if (!planKey || !(planKey in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid plan selected." },
        { status: 400 },
      );
    }

    if (!isDepositChain(chain)) {
      return NextResponse.json(
        { error: "Invalid deposit currency." },
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
    const planSize = getPlanKeyValue(selectedPlan.planKey);
    const feeAmount = Number(selectedPlan.feeAmount);

    if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid plan fee amount." },
        { status: 400 },
      );
    }

    const { data: existingUser, error: existingUserError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("privy_user_id", privyUserId)
        .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    let userId = existingUser?.id as string | undefined;

    if (!userId) {
      const { data: insertedUser, error: insertUserError } =
        await supabaseAdmin
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

      userId = insertedUser.id;
    } else {
      const { error: updateUserError } = await supabaseAdmin
        .from("users")
        .update({
          email: email ?? null,
          wallet_address: walletAddress ?? null,
        })
        .eq("id", userId);

      if (updateUserError) {
        throw updateUserError;
      }
    }

    const destinationAmountAtomic = makePlanUsdcAmountAtomic(feeAmount);
    const destinationAmountDisplay = usdcAtomicToDisplay(
      destinationAmountAtomic,
    );

    const relayQuote = await createRelayDepositQuote({
      chain,
      destinationAmountAtomic,
    });

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .insert({
        user_id: userId,
        plan_key: selectedPlan.planKey,

        provider: "relay",

        chain,
        asset: getDepositAsset(chain),

        deposit_address: relayQuote.depositAddress,
        relay_deposit_address: relayQuote.depositAddress,
        relay_request_id: relayQuote.requestId,
        relay_status: "waiting",
        relay_origin_chain_id: relayQuote.originChainId,
        relay_origin_currency: relayQuote.originCurrency,
        relay_destination_chain_id: relayQuote.destinationChainId,
        relay_destination_currency: relayQuote.destinationCurrency,
        relay_quote: relayQuote.quote,

        expected_from_address: null,

        expected_amount_atomic: relayQuote.amountInAtomic,
        expected_amount_display: relayQuote.amountInDisplay,

        expected_destination_amount_atomic: destinationAmountAtomic.toString(),
        expected_destination_amount_display: destinationAmountDisplay,
        destination_address: DESTINATION_CONFIG.recipient,

        status: "pending",
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),

        account_starting_balance: planSize,
        account_profit_target_percent: PROFIT_TARGET_PERCENT,
        account_max_risk_amount:
          planSize * (MAX_RISK_PER_TRADE_PERCENT / 100),
        account_daily_loss_limit_amount:
          planSize * (DAILY_DRAWDOWN_PERCENT / 100),
        account_total_loss_limit_amount:
          planSize * (TOTAL_DRAWDOWN_PERCENT / 100),
        one_time_fee: selectedPlan.feeAmount,
      })
      .select(
        `
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
        credited_account_id
      `,
      )
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    console.log("[crypto-deposits/create] created Relay invoice", {
      invoiceId: invoice.id,
      planKey,
      chain,
      asset: invoice.asset,
      amount: invoice.expected_amount_display,
      depositAddress: invoice.deposit_address,
      relayRequestId: invoice.relay_request_id,
      destinationAddress: invoice.destination_address,
      destinationAmount: invoice.expected_destination_amount_display,
      expiresAt: invoice.expires_at,
    });

    return NextResponse.json({
      ok: true,
      invoice,
    });
  } catch (error) {
    console.error("Create Relay crypto deposit invoice error:", error);

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