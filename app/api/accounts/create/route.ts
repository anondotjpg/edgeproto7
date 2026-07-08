import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { privyServer } from "@/lib/privy-server";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";

export const dynamic = "force-dynamic";

type CreateAccountBody = {
  planKey?: PlanKey;
  email?: string | null;
  walletAddress?: string | null;
};

const PROFIT_TARGET_PERCENT = 25;
const DAILY_DRAWDOWN_PERCENT = 2;
const TOTAL_DRAWDOWN_PERCENT = 5;
const MAX_RISK_PER_TRADE_PERCENT = 5;

async function getVerifiedPrivyUserId() {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return {
      privyUserId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const verifiedClaims = await privyServer
    .utils()
    .auth()
    .verifyAuthToken(accessToken);

  const privyUserId = verifiedClaims.user_id;

  if (!privyUserId) {
    return {
      privyUserId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    privyUserId,
    response: null,
  };
}

export async function POST(req: Request) {
  try {
    const { privyUserId, response } = await getVerifiedPrivyUserId();

    if (response) {
      return response;
    }

    if (!privyUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CreateAccountBody;
    const { planKey, email, walletAddress } = body;

    if (!planKey || !(planKey in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid plan selected." },
        { status: 400 },
      );
    }

    const selectedPlan = PLAN_CONFIG[planKey];
    const planSize = Number(selectedPlan.planKey);

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    let userId = existingUser?.id as string | undefined;

    if (!userId) {
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

    const { data: insertedAccount, error: insertAccountError } =
      await supabaseAdmin
        .from("challenge_accounts")
        .insert({
          user_id: userId,
          plan_key: selectedPlan.planKey,
          plan_size: planSize,
          starting_balance: planSize,
          current_balance: planSize,
          reserved_risk: 0,
          realized_pnl: 0,
          one_time_fee: selectedPlan.feeAmount,
          status: "active_dev",

          profit_target_percent: PROFIT_TARGET_PERCENT,
          daily_drawdown_percent: DAILY_DRAWDOWN_PERCENT,
          total_drawdown_percent: TOTAL_DRAWDOWN_PERCENT,
          min_trading_days: 7,
          max_inactivity_days: 14,
          max_risk_per_trade_percent: MAX_RISK_PER_TRADE_PERCENT,
        })
        .select("id")
        .single();

    if (insertAccountError) {
      throw insertAccountError;
    }

    const accountId = insertedAccount.id as string;

    const { error: eventError } = await supabaseAdmin
      .from("account_events")
      .insert({
        account_id: accountId,
        type: "account_created",
        payload: {
          planKey: selectedPlan.planKey,
          planSize,
          feeAmount: selectedPlan.feeAmount,
          startingBalance: planSize,
          currentBalance: planSize,
          reservedRisk: 0,
          realizedPnl: 0,
          rules: {
            profitTargetPercent: PROFIT_TARGET_PERCENT,
            dailyDrawdownPercent: DAILY_DRAWDOWN_PERCENT,
            totalDrawdownPercent: TOTAL_DRAWDOWN_PERCENT,
            maxRiskPerTradePercent: MAX_RISK_PER_TRADE_PERCENT,
          },
        },
      });

    if (eventError) {
      throw eventError;
    }

    return NextResponse.json({
      ok: true,
      accountId,
    });
  } catch (error) {
    console.error("Create account error:", error);

    return NextResponse.json(
      { error: "Unable to create account." },
      { status: 500 },
    );
  }
}