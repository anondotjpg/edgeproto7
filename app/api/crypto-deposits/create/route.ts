import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";
import {
  atomicToDisplay,
  CHAIN_CONFIG,
  type DepositChain,
  getDepositAddress,
  makeInvoiceAmountAtomic,
} from "@/lib/crypto-deposits";

type CreateDepositBody = {
  planKey?: PlanKey;
  chain?: DepositChain;
  fromAddress?: string;
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string | null;
};

const PROFIT_TARGET_PERCENT = 25;
const DAILY_DRAWDOWN_PERCENT = 2;
const TOTAL_DRAWDOWN_PERCENT = 5;
const MAX_RISK_PER_TRADE_PERCENT = 5;

function isValidSolanaAddress(address: string) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDepositBody;

    const {
      planKey,
      chain,
      fromAddress,
      privyUserId,
      email,
      walletAddress,
    } = body;

    if (!planKey || !(planKey in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid plan selected." },
        { status: 400 },
      );
    }

    if (!chain || !(chain in CHAIN_CONFIG)) {
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

    const cleanFromAddress = String(fromAddress || "").trim();

    if (!isValidSolanaAddress(cleanFromAddress)) {
      return NextResponse.json(
        { error: "Invalid SOL sending address." },
        { status: 400 },
      );
    }

    const selectedPlan = PLAN_CONFIG[planKey];
    const planSize = Number(selectedPlan.planKey);

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

    const amountAtomic = makeInvoiceAmountAtomic({ planKey, chain });
    const amountDisplay = atomicToDisplay({ chain, atomic: amountAtomic });

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .insert({
        user_id: userId,
        plan_key: selectedPlan.planKey,

        chain,
        asset: CHAIN_CONFIG[chain].asset,

        deposit_address: getDepositAddress(chain),
        expected_from_address: cleanFromAddress,

        expected_amount_atomic: amountAtomic.toString(),
        expected_amount_display: amountDisplay,

        status: "pending",
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),

        account_starting_balance: planSize,
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
        chain,
        asset,
        deposit_address,
        expected_from_address,
        expected_amount_display,
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

    console.log("[crypto-deposits/create] created invoice", {
      invoiceId: invoice.id,
      planKey,
      chain,
      amount: invoice.expected_amount_display,
      depositAddress: invoice.deposit_address,
      expiresAt: invoice.expires_at,
    });

    return NextResponse.json({
      ok: true,
      invoice,
    });
  } catch (error) {
    console.error("Create crypto deposit invoice error:", error);

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