import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { privyServer } from "@/lib/privy-server";

const MIN_PAYOUT_PNL = 2500;

type PayoutRequestBody = {
  accountId?: string | null;
};

type RpcLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function formatMoney(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getErrorMessage(error: RpcLikeError | null | undefined) {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ");
}

export async function POST(req: Request) {
  try {
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

    const body = (await req.json().catch(() => ({}))) as PayoutRequestBody;
    const accountId = cleanText(body.accountId);

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing account ID." },
        { status: 400 },
      );
    }

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError) throw userError;

    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("challenge_accounts")
      .select(
        `
        id,
        user_id,
        account_name,
        plan_size,
        status,
        funded_current_balance,
        funded_reserved_risk,
        funded_realized_pnl
      `,
      )
      .eq("id", accountId)
      .eq("user_id", dbUser.id)
      .maybeSingle();

    if (accountError) throw accountError;

    if (!account) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 },
      );
    }

    if (account.status !== "funded") {
      return NextResponse.json(
        { error: "Only funded accounts can request payouts." },
        { status: 400 },
      );
    }

    const fundedRealizedPnl = Number(account.funded_realized_pnl ?? 0);

    if (!Number.isFinite(fundedRealizedPnl) || fundedRealizedPnl < MIN_PAYOUT_PNL) {
      return NextResponse.json(
        {
          code: "PAYOUT_MINIMUM_NOT_MET",
          error: `P/L must be at least ${formatMoney(
            MIN_PAYOUT_PNL,
          )} to request a payout.`,
          minimumPnl: MIN_PAYOUT_PNL,
          currentPnl: fundedRealizedPnl,
        },
        { status: 400 },
      );
    }

    const { data: existingRequest, error: existingRequestError } =
      await supabaseAdmin
        .from("payout_requests")
        .select("id, status, requested_at")
        .eq("account_id", account.id)
        .eq("status", "pending")
        .maybeSingle();

    if (existingRequestError) throw existingRequestError;

    if (existingRequest) {
      return NextResponse.json(
        {
          code: "PAYOUT_ALREADY_REQUESTED",
          error: "A payout request is already pending for this account.",
          request: existingRequest,
        },
        { status: 409 },
      );
    }

    const requestedAmount = fundedRealizedPnl;
    const fundedCurrentBalance = Number(account.funded_current_balance ?? 0);
    const fundedReservedRisk = Number(account.funded_reserved_risk ?? 0);
    const fundedEquity = fundedCurrentBalance + fundedReservedRisk;

    const { data: payoutRequest, error: payoutRequestError } =
      await supabaseAdmin
        .from("payout_requests")
        .insert({
          user_id: dbUser.id,
          account_id: account.id,
          account_name: account.account_name,
          plan_size: account.plan_size,
          status: "pending",
          requested_amount: requestedAmount,
          funded_realized_pnl: fundedRealizedPnl,
          funded_current_balance: fundedCurrentBalance,
          funded_reserved_risk: fundedReservedRisk,
          funded_equity: fundedEquity,
        })
        .select(
          "id, account_id, status, requested_amount, funded_realized_pnl, requested_at",
        )
        .single();

    if (payoutRequestError) {
      if (payoutRequestError.code === "23505") {
        return NextResponse.json(
          {
            code: "PAYOUT_ALREADY_REQUESTED",
            error: "A payout request is already pending for this account.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: getErrorMessage(payoutRequestError) || "Unable to request payout.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      request: payoutRequest,
    });
  } catch (error) {
    console.error("Payout request error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to request payout.",
      },
      { status: 500 },
    );
  }
}