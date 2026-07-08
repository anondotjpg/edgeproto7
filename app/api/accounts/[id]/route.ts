import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { privyServer } from "@/lib/privy-server";

export const dynamic = "force-dynamic";

type AccountRouteContext = {
  params: Promise<{ id: string }>;
};

function getTodayNewYorkDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hasPositiveAccountValue(value: unknown) {
  return Number(value ?? 0) > 0;
}

function hasNonZeroAccountValue(value: unknown) {
  return Number(value ?? 0) !== 0;
}

function getCurrentAccountStage(account: Record<string, unknown>) {
  const accountStatus = String(account.status);
  const isActuallyFunded = accountStatus === "funded";
  const isAccountFailed = accountStatus === "failed";

  const hasFundedLifecycleData =
    Boolean(account.funded_at) ||
    Boolean(account.funded_started_at) ||
    Boolean(account.passed_at);

  const hasFundedBalanceData =
    hasPositiveAccountValue(account.funded_starting_balance) ||
    hasPositiveAccountValue(account.funded_current_balance) ||
    hasPositiveAccountValue(account.funded_reserved_risk) ||
    hasNonZeroAccountValue(account.funded_realized_pnl);

  const shouldDisplayFundedData =
    isActuallyFunded ||
    (isAccountFailed && (hasFundedLifecycleData || hasFundedBalanceData));

  return shouldDisplayFundedData ? "funded" : "challenge";
}

export async function GET(_request: Request, { params }: AccountRouteContext) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing account ID." },
        { status: 400 },
      );
    }

    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verifiedClaims = await privyServer
      .utils()
      .auth()
      .verifyAuthToken(accessToken);

    const privyUserId = verifiedClaims.user_id;

    if (!privyUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("challenge_accounts")
      .select("*")
      .eq("id", id)
      .eq("user_id", dbUser.id)
      .maybeSingle();

    if (accountError) {
      throw accountError;
    }

    if (!account) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 },
      );
    }

    const currentStage = getCurrentAccountStage(
      account as Record<string, unknown>,
    );
    const today = getTodayNewYorkDate();

    const [{ data: bets, error: betsError }, { data: dailySnapshot }] =
      await Promise.all([
        supabaseAdmin
          .from("bets")
          .select(
            `
            id,
            selection,
            league,
            market,
            odds,
            stake,
            potential_profit,
            potential_payout,
            status,
            result,
            settlement_amount,
            settlement_reason,
            account_stage,
            placed_at,
            settled_at,
            team_logo,
            team_logo_alt,
            polymarket_winning_outcome,
            polymarket_resolution_error
          `,
          )
          .eq("account_id", account.id)
          .order("placed_at", { ascending: false }),

        supabaseAdmin
          .from("account_daily_snapshots")
          .select("starting_balance")
          .eq("account_id", account.id)
          .eq("day", today)
          .eq("account_stage", currentStage)
          .maybeSingle(),
      ]);

    if (betsError) {
      throw betsError;
    }

    return NextResponse.json({
      account,
      bets: bets ?? [],
      dailySnapshot: dailySnapshot ?? null,
    });
  } catch (error) {
    console.error("Load account detail error:", error);

    return NextResponse.json(
      { error: "Failed to load account." },
      { status: 500 },
    );
  }
}