"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { IoWarningOutline } from "react-icons/io5";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";
import AccountPositionsTable from "./AccountPositionsTable";
import AccountPageSkeleton from "./AccountPageSkeleton";

type BetRow = {
  id: string;
  selection: string;
  league: string;
  market: string;
  odds: number;
  stake: number;
  potential_profit: number;
  potential_payout: number;
  status: string;
  result: string | null;
  settlement_amount: number | null;
  settlement_reason: string | null;
  account_stage: string | null;
  placed_at: string;
  settled_at: string | null;
  team_logo: string | null;
  team_logo_alt: string | null;
  polymarket_winning_outcome: string | null;
  polymarket_resolution_error: string | null;
};

type AccountRow = {
  id: string;
  user_id: string;
  plan_key: string;
  plan_size: number;
  one_time_fee: number;
  status: string;
  profit_target_percent: number | null;
  daily_drawdown_percent: number | null;
  total_drawdown_percent: number | null;
  min_trading_days: number | null;
  max_inactivity_days: number | null;
  max_risk_per_trade_percent: number | null;
  reward_percent: number | null;
  created_at: string;
  starting_balance: number | null;
  current_balance: number | null;
  reserved_risk: number | null;
  realized_pnl: number | null;
  max_risk_amount: number | null;
  daily_loss_limit_amount: number | null;
  total_loss_limit_amount: number | null;
  passed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  account_name: string | null;
  updated_at: string | null;

  funded_at?: string | null;
  funded_started_at: string | null;
  funded_starting_balance: number | null;
  funded_current_balance: number | null;
  funded_reserved_risk: number | null;
  funded_realized_pnl: number | null;
  funded_max_risk_amount: number | null;
  funded_daily_loss_limit_amount: number | null;
  funded_total_loss_limit_amount: number | null;
  funded_failed_at: string | null;
  funded_failure_reason: string | null;
};

type DailySnapshotRow = {
  starting_balance: number | null;
};

type AccountDetailResponse = {
  account: AccountRow;
  bets: BetRow[];
  dailySnapshot: DailySnapshotRow | null;
};

function formatMoney(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMoneyDisplayParts(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);
  const sign = safeValue < 0 ? "-" : "";
  const formatted = Math.abs(safeValue).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [whole = "0", decimals = "00"] = formatted.split(".");

  return {
    whole: `${sign}$${whole}`,
    decimals: `.${decimals}`,
  };
}

function MoneyAmount({
  value,
  className = "",
  decimalsClassName = "",
}: {
  value: number | null | undefined;
  className?: string;
  decimalsClassName?: string;
}) {
  const { whole, decimals } = getMoneyDisplayParts(value);

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      <span>{whole}</span>
      <span className={decimalsClassName}>{decimals}</span>
    </span>
  );
}

function formatMoneyInteger(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatSignedMoney(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);
  const sign = safeValue > 0 ? "+" : safeValue < 0 ? "-" : "";

  return `${sign}${formatMoney(Math.abs(safeValue))}`;
}

function formatCompactAccountSize(value: number | null | undefined) {
  const size = Number(value ?? 0);

  if (!size) return "";

  if (size >= 1000) {
    return `${Math.round(size / 1000)}k`;
  }

  return String(size);
}

function hasPositiveAccountValue(value: unknown) {
  return Number(value ?? 0) > 0;
}

function hasNonZeroAccountValue(value: unknown) {
  return Number(value ?? 0) !== 0;
}

function getSettledSortTime(bet: Pick<BetRow, "settled_at" | "placed_at">) {
  const timestamp = Date.parse(bet.settled_at ?? bet.placed_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortPastBetsBySettledAt(bets: BetRow[]) {
  return [...bets].sort(
    (a, b) => getSettledSortTime(b) - getSettledSortTime(a),
  );
}

function pnlColor(value: number) {
  if (value > 0) return "text-green-500";
  if (value < 0) return "text-red-400";
  return "text-zinc-100";
}

type SegmentedBarTone = "goal" | "loss";

function SegmentedProgressBars({
  value,
  barCount,
  tone,
  failedFinal = false,
}: {
  value: number;
  barCount: number;
  tone: SegmentedBarTone;
  failedFinal?: boolean;
}) {
  const progress = Math.min(Math.max(value, 0), 100);
  const step = 100 / barCount;
  const filledBarCount = Math.ceil((progress / 100) * barCount);
  const hasFailedFinal = failedFinal && tone === "goal" && progress > 0;

  const getBarFill = (index: number) => {
    const barStart = index * step;
    const barEnd = barStart + step;

    if (progress >= barEnd) return 1;
    if (progress <= barStart) return 0;

    return (progress - barStart) / step;
  };

  const getBarColor = (index: number) => {
    const ratio = barCount <= 1 ? 1 : index / (barCount - 1);

    if (tone === "loss") {
      const hue = 48 - ratio * 48;
      return `hsl(${hue} 92% 55%)`;
    }

    const hue = 42 + ratio * 98;
    return `hsl(${hue} 82% 52%)`;
  };

  const getFillDelay = (index: number) => {
    const lastFilledIndex = Math.max(filledBarCount - 1, 1);
    const ratio = Math.min(Math.max(index / lastFilledIndex, 0), 1);
    const delayMs = 55 + index * 10 + Math.pow(ratio, 2.15) * 420;

    return `${Math.round(delayMs)}ms`;
  };

  const failedBlinkDelay = (() => {
    if (!hasFailedFinal) return undefined;

    const lastFilledIndex = Math.max(filledBarCount - 1, 0);
    const fillDelay = Number.parseInt(getFillDelay(lastFilledIndex), 10);

    return `${fillDelay + 430}ms`;
  })();

  return (
    <>
      <style>{`
        @keyframes segmented-progress-fill {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(var(--target-scale));
          }
        }

        @keyframes segmented-progress-failed-blink {
          0%, 13% {
            background-color: var(--bar-base-color);
            box-shadow: none;
          }
          14%, 27% {
            background-color: var(--failed-bar-color);
            box-shadow: 0 0 12px rgba(248, 113, 113, 0.18);
          }
          28%, 41% {
            background-color: var(--bar-base-color);
            box-shadow: none;
          }
          42%, 55% {
            background-color: var(--failed-bar-color);
            box-shadow: 0 0 12px rgba(248, 113, 113, 0.18);
          }
          56%, 69% {
            background-color: var(--bar-base-color);
            box-shadow: none;
          }
          70%, 100% {
            background-color: var(--failed-bar-color);
            box-shadow: 0 0 12px rgba(248, 113, 113, 0.18);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .segmented-progress-fill {
            animation: none !important;
            transform: scaleX(var(--target-scale)) !important;
          }

          .segmented-progress-failed-final {
            background-color: var(--failed-bar-color) !important;
          }
        }
      `}</style>

      <div className="flex h-8 w-full items-center sm:h-9">
        <div
          className="grid h-6 w-full items-stretch gap-[3px] sm:h-7"
          style={{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: barCount }).map((_, index) => {
            const fill = getBarFill(index);
            const shouldAnimate = fill > 0;
            const baseColor = getBarColor(index);
            const animations = [
              shouldAnimate
                ? "segmented-progress-fill 340ms cubic-bezier(0.16, 1, 0.3, 1) forwards"
                : null,
              hasFailedFinal
                ? "segmented-progress-failed-blink 1180ms ease-in-out forwards"
                : null,
            ].filter(Boolean);
            const animationDelays = [
              shouldAnimate ? getFillDelay(index) : null,
              hasFailedFinal ? failedBlinkDelay : null,
            ].filter(Boolean);

            return (
              <div
                key={index}
                className="relative min-w-0 overflow-hidden rounded-full bg-zinc-900"
              >
                {fill > 0 ? (
                  <div
                    className={[
                      "segmented-progress-fill absolute inset-y-0 left-0 h-full origin-left rounded-full",
                      hasFailedFinal ? "segmented-progress-failed-final" : "",
                    ].join(" ")}
                    style={
                      {
                        "--target-scale": fill.toString(),
                        "--bar-base-color": baseColor,
                        "--failed-bar-color": "#ef4444",
                        width: "100%",
                        backgroundColor: baseColor,
                        transform: shouldAnimate
                          ? "scaleX(0)"
                          : `scaleX(${fill})`,
                        animation: animations.length
                          ? animations.join(", ")
                          : undefined,
                        animationDelay: animationDelays.length
                          ? animationDelays.join(", ")
                          : undefined,
                        willChange: shouldAnimate || hasFailedFinal
                          ? "transform, background-color, box-shadow"
                          : undefined,
                      } as React.CSSProperties
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ResponsiveProgressBars({
  value,
  tone,
  failedFinal = false,
}: {
  value: number;
  tone: SegmentedBarTone;
  failedFinal?: boolean;
}) {
  return (
    <>
      <div className="md:hidden">
        <SegmentedProgressBars
          value={value}
          barCount={42}
          tone={tone}
          failedFinal={failedFinal}
        />
      </div>

      <div className="hidden md:block xl:hidden">
        <SegmentedProgressBars
          value={value}
          barCount={53}
          tone={tone}
          failedFinal={failedFinal}
        />
      </div>

      <div className="hidden xl:block">
        <SegmentedProgressBars
          value={value}
          barCount={63}
          tone={tone}
          failedFinal={failedFinal}
        />
      </div>
    </>
  );
}

function GoalProgressBar({
  value,
  failedFinal = false,
}: {
  value: number;
  failedFinal?: boolean;
}) {
  return (
    <ResponsiveProgressBars
      value={value}
      tone="goal"
      failedFinal={failedFinal}
    />
  );
}

function LossRuleProgressBar({ value }: { value: number }) {
  return (
    <>
      <div className="md:hidden">
        <SegmentedProgressBars value={value} barCount={21} tone="loss" />
      </div>

      <div className="hidden md:block xl:hidden">
        <SegmentedProgressBars value={value} barCount={53} tone="loss" />
      </div>

      <div className="hidden xl:block">
        <SegmentedProgressBars value={value} barCount={63} tone="loss" />
      </div>
    </>
  );
}

function FailedLossRuleProgressBar() {
  return (
    <>
      <div className="md:hidden">
        <FailedSegmentedBars barCount={21} />
      </div>

      <div className="hidden md:block xl:hidden">
        <FailedSegmentedBars barCount={53} />
      </div>

      <div className="hidden xl:block">
        <FailedSegmentedBars barCount={63} />
      </div>
    </>
  );
}

function FailedSegmentedBars({ barCount }: { barCount: number }) {
  return (
    <div className="flex h-8 w-full items-center sm:h-9">
      <div
        className="grid h-6 w-full items-stretch gap-[3px] sm:h-7"
        style={{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: barCount }).map((_, index) => (
          <div
            key={index}
            className="relative min-w-0 overflow-hidden rounded-full bg-zinc-900"
          >
            <div className="absolute inset-0 rounded-full bg-red-500 shadow-[0_0_12px_rgba(248,113,113,0.14)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileTwoLineRuleTitle({
  title,
  className,
}: {
  title: string;
  className: string;
}) {
  const [firstWord, ...remainingWords] = title.split(" ");
  const restTitle = remainingWords.join(" ");

  return (
    <div className={className}>
      <span className="block sm:inline">{firstWord}</span>
      {restTitle ? (
        <>
          <span className="hidden sm:inline"> </span>
          <span className="block sm:inline">{restTitle}</span>
        </>
      ) : null}
    </div>
  );
}

function RuleRoomCard({
  title,
  room,
  limit,
  isAccountFailed,
}: {
  title: string;
  room: number;
  limit: number;
  isAccountFailed: boolean;
}) {
  if (isAccountFailed) {
    return (
      <div className="relative flex min-h-[118px] flex-col overflow-hidden rounded-[22px] bg-zinc-950/80 px-3 py-3 shadow-[inset_0_0_36px_rgba(239,68,68,0.07),inset_0_1px_0_rgba(248,113,113,0.04)] sm:min-h-[166px] sm:rounded-[26px] sm:px-5 sm:py-4 sm:shadow-none sm:ring-1 sm:ring-zinc-900">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.09),transparent_56%),radial-gradient(circle_at_50%_100%,rgba(127,29,29,0.07),transparent_62%)] sm:hidden"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-px rounded-[21px] shadow-[inset_0_0_24px_rgba(248,113,113,0.05)] sm:hidden sm:rounded-[25px]"
        />

        <div className="relative flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <MobileTwoLineRuleTitle
              title={title}
              className="text-[14px] font-medium leading-tight text-red-300/60 sm:text-[17px]"
            />
          </div>

          <div className="min-w-0 max-w-[60%] shrink-0 pt-0.5 text-right sm:max-w-none">
            <div className="flex items-center justify-end gap-1 text-[17px] font-semibold leading-tight tracking-tight text-red-200 sm:gap-2 sm:text-[28px]">
              <IoWarningOutline
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-red-300/80 sm:h-6 sm:w-6"
              />
              <span>Failed</span>
            </div>

            <div className="mt-0.5 truncate text-[11px] leading-tight text-red-300/50 sm:mt-1 sm:text-[13px]">
              limit breached
            </div>
          </div>
        </div>

        <div className="relative mt-auto pt-3 sm:pt-2">
          <FailedLossRuleProgressBar />
        </div>
      </div>
    );
  }

  const breached = room <= 0;
  const safeRoom = Math.max(room, 0);

  const usedPercent =
    limit > 0
      ? Math.min(Math.max(((limit - safeRoom) / limit) * 100, 0), 100)
      : 0;

  return (
    <div className="relative flex min-h-[118px] flex-col overflow-hidden rounded-[22px] bg-zinc-950/80 px-3 py-3 shadow-[inset_0_0_36px_rgba(161,161,170,0.04),inset_0_1px_0_rgba(244,244,245,0.02)] sm:min-h-[166px] sm:rounded-[26px] sm:px-5 sm:py-4 sm:shadow-none sm:ring-1 sm:ring-zinc-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(161,161,170,0.06),transparent_56%),radial-gradient(circle_at_50%_100%,rgba(39,39,42,0.14),transparent_62%)] sm:hidden"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px rounded-[21px] shadow-[inset_0_0_24px_rgba(212,212,216,0.03)] sm:hidden sm:rounded-[25px]"
      />

      <div className="relative flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <MobileTwoLineRuleTitle
            title={title}
            className="text-[14px] font-medium leading-tight text-zinc-500 sm:text-[17px]"
          />

          <div className="mt-2 hidden min-h-[34px] truncate text-[28px] font-semibold leading-tight tracking-tight text-zinc-100 sm:block">
            {breached ? "Failed" : formatMoney(safeRoom)}
          </div>

          <div className="mt-1 hidden truncate text-[13px] leading-tight text-zinc-500 sm:block">
            {breached ? "limit breached" : "before fail"}
          </div>
        </div>

        <div className="min-w-0 max-w-[60%] shrink-0 pt-0.5 text-right sm:hidden">
          <div className="truncate text-[17px] font-semibold leading-tight tracking-tight text-zinc-100">
            {breached ? "Failed" : formatMoney(safeRoom)}
          </div>

          <div className="mt-0.5 truncate text-[11px] leading-tight text-zinc-500">
            {breached ? "limit breached" : "before fail"}
          </div>
        </div>
      </div>

      <div className="relative mt-auto pt-3 sm:pt-2">
        <LossRuleProgressBar value={usedPercent} />
      </div>
    </div>
  );
}

function PageState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-20 sm:px-6">
        <div className="w-full rounded-[24px] bg-zinc-950/70 p-5 ring-1 ring-zinc-900 sm:p-6">
          <div className="text-[18px] font-semibold tracking-tight text-zinc-100">
            {title}
          </div>

          <p className="mt-2 max-w-xl text-[14px] leading-6 text-zinc-500">
            {description}
          </p>

          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { ready, authenticated, getAccessToken, login } = usePrivy();

  const [data, setData] = useState<AccountDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      if (!ready) return;

      if (!authenticated) {
        setLoading(false);
        setData(null);
        setLoadError(null);
        return;
      }

      if (!id) {
        setLoading(false);
        setData(null);
        setLoadError("Missing account ID.");
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);

        const accessToken = await getAccessToken();

        if (!accessToken) {
          throw new Error("Missing access token.");
        }

        const response = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const json = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(json?.error || "Failed to load account.");
        }

        if (!cancelled) {
          setData(json as AccountDetailResponse);
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setLoadError(
            error instanceof Error ? error.message : "Failed to load account.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, id]);

  const account = data?.account ?? null;
  const bets = useMemo(() => data?.bets ?? [], [data?.bets]);
  const dailySnapshot = data?.dailySnapshot ?? null;

  if (!ready || loading) {
    return <AccountPageSkeleton />;
  }

  if (!authenticated) {
    return (
      <PageState
        title="Sign in required"
        description="You need to sign in to view this account."
        action={
          <button
            type="button"
            onClick={login}
            className="inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Sign in
          </button>
        }
      />
    );
  }

  if (loadError || !account) {
    return (
      <PageState
        title="Account not found"
        description={
          loadError ||
          "This account does not exist, or you do not have access to it."
        }
        action={
          <Link
            href="/accounts"
            className="inline-flex rounded-xl bg-black/30 px-4 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            Back to accounts
          </Link>
        }
      />
    );
  }

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

  const currentStage = shouldDisplayFundedData ? "funded" : "challenge";

  const plan = PLAN_CONFIG[account.plan_key as PlanKey];

  const startingBalance = shouldDisplayFundedData
    ? Number(
        account.funded_starting_balance ??
          account.starting_balance ??
          account.plan_size ??
          0,
      )
    : Number(account.starting_balance ?? account.plan_size ?? 0);

  const currentBalance = shouldDisplayFundedData
    ? Number(account.funded_current_balance ?? startingBalance)
    : Number(account.current_balance ?? 0);

  const reservedRisk = shouldDisplayFundedData
    ? Number(account.funded_reserved_risk ?? 0)
    : Number(account.reserved_risk ?? 0);

  const realizedPnl = shouldDisplayFundedData
    ? Number(account.funded_realized_pnl ?? 0)
    : Number(account.realized_pnl ?? 0);

  const hasRealizedPnlChange =
    Number.isFinite(realizedPnl) && realizedPnl !== 0;

  const ruleEquity = currentBalance + reservedRisk;

  const profitTargetPercent = Number(account.profit_target_percent ?? 30);
  const dailyDrawdownPercent = shouldDisplayFundedData
    ? 4
    : Number(account.daily_drawdown_percent ?? 10);
  const totalDrawdownPercent = shouldDisplayFundedData
    ? 10
    : Number(account.total_drawdown_percent ?? 20);

  const profitTargetBalance = shouldDisplayFundedData
    ? startingBalance
    : startingBalance * (1 + profitTargetPercent / 100);

  const dailyLossLimit = Number(
    shouldDisplayFundedData
      ? (account.funded_daily_loss_limit_amount ??
          startingBalance * (dailyDrawdownPercent / 100))
      : (account.daily_loss_limit_amount ??
          startingBalance * (dailyDrawdownPercent / 100)),
  );

  const totalLossLimit = Number(
    shouldDisplayFundedData
      ? (account.funded_total_loss_limit_amount ??
          startingBalance * (totalDrawdownPercent / 100))
      : (account.total_loss_limit_amount ??
          startingBalance * (totalDrawdownPercent / 100)),
  );

  const dayStartingBalance = Number(
    dailySnapshot?.starting_balance ?? ruleEquity,
  );

  const dailyFloor = dayStartingBalance - dailyLossLimit;
  const totalFloor = startingBalance - totalLossLimit;

  const goalProgress =
    profitTargetBalance > startingBalance
      ? ((ruleEquity - startingBalance) /
          (profitTargetBalance - startingBalance)) *
        100
      : 0;

  const visibleBets = bets.filter(
    (bet) => (bet.account_stage ?? "challenge") === currentStage,
  );

  const openBets = visibleBets.filter((bet) => bet.status === "open");
  const pastBets = sortPastBetsBySettledAt(
    visibleBets.filter((bet) => bet.status !== "open"),
  );

  const compactAccountSize = formatCompactAccountSize(Number(account.plan_size));

  const fallbackAccountTitle = compactAccountSize
    ? `$${compactAccountSize}`
    : (plan?.sizeLabel ?? formatMoneyInteger(account.plan_size));

  const accountName =
    typeof account.account_name === "string" ? account.account_name.trim() : "";

  const pageTitle =
    accountName ||
    `${fallbackAccountTitle} ${
      shouldDisplayFundedData ? "Funded" : "Challenge"
    }`;

  const dailyRoom = ruleEquity - dailyFloor;
  const totalRoom = ruleEquity - totalFloor;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pt-20 pb-32 sm:px-6 md:py-15 md:pb-24">
        <section>
          <div
            className={[
              "grid items-stretch gap-3",
              shouldDisplayFundedData ? "" : "lg:grid-cols-2",
            ].join(" ")}
          >
            <div className="flex min-h-[132px] min-w-0 flex-col overflow-visible sm:min-h-[166px] lg:min-h-[166px]">
              <div className="flex min-w-0 items-start">
                <h1 className="min-w-0 truncate text-[14px] font-semibold leading-tight tracking-tight text-zinc-500 sm:text-[24px] sm:text-zinc-200 lg:text-[26px]">
                  {pageTitle}
                </h1>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center pt-3 pb-2 text-center sm:items-start sm:justify-start sm:pt-5 sm:pb-0 sm:text-left">
                <div className="flex max-w-full items-end justify-center gap-3 sm:justify-start">
                  <MoneyAmount
                    value={ruleEquity}
                    className="max-w-full text-[43px] font-semibold leading-none tracking-[-0.06em] text-zinc-50 sm:text-[44px] lg:text-[46px]"
                    decimalsClassName="ml-0.5 text-[0.58em] font-medium tracking-[-0.035em] text-zinc-500"
                  />

                  {hasRealizedPnlChange ? (
                    <div
                      className={[
                        "mb-1 hidden shrink-0 text-right text-[14px] font-semibold leading-none sm:block lg:text-[15px]",
                        pnlColor(realizedPnl),
                      ].join(" ")}
                    >
                      {formatSignedMoney(realizedPnl)}
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 truncate text-[12px] font-medium leading-tight text-zinc-500 sm:mt-2 sm:text-[13px]">
                  {formatMoney(currentBalance)} avail.
                </div>
              </div>
            </div>

            {!shouldDisplayFundedData ? (
              <div
                className={[
                  "relative flex min-h-[132px] flex-col overflow-hidden rounded-[26px] bg-zinc-950/80 px-4 py-4 sm:min-h-[166px] sm:px-5",
                  isAccountFailed
                    ? "shadow-[inset_0_0_36px_rgba(239,68,68,0.07),inset_0_1px_0_rgba(248,113,113,0.04)] sm:shadow-none"
                    : "shadow-[inset_0_0_36px_rgba(161,161,170,0.04),inset_0_1px_0_rgba(244,244,245,0.02)] sm:shadow-none",
                ].join(" ")}
              >
                {isAccountFailed ? (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.09),transparent_56%),radial-gradient(circle_at_50%_100%,rgba(127,29,29,0.07),transparent_62%)] sm:hidden"
                    />

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-px rounded-[25px] shadow-[inset_0_0_24px_rgba(248,113,113,0.05)] sm:hidden"
                    />
                  </>
                ) : (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(161,161,170,0.06),transparent_56%),radial-gradient(circle_at_50%_100%,rgba(39,39,42,0.14),transparent_62%)] sm:hidden"
                    />

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-px rounded-[25px] shadow-[inset_0_0_24px_rgba(212,212,216,0.03)] sm:hidden"
                    />
                  </>
                )}

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div
                      className={[
                        "text-[17px] font-medium leading-tight",
                        isAccountFailed ? "text-red-300/70" : "text-zinc-500",
                      ].join(" ")}
                    >
                      {isAccountFailed ? "Failed" : "Goal"}
                    </div>

                    <div className="mt-2 hidden min-h-[34px] truncate text-[28px] font-semibold leading-tight tracking-tight text-zinc-100 sm:block">
                      {formatMoney(ruleEquity)}
                    </div>

                    <div className="mt-1 hidden truncate text-[13px] font-medium leading-tight text-zinc-500 sm:block">
                      of {formatMoney(profitTargetBalance)} goal
                    </div>
                  </div>

                  <div className="min-w-0 pt-0.5 text-right sm:hidden">
                    <div className="truncate text-[22px] font-semibold leading-tight tracking-tight text-zinc-100">
                      {formatMoney(ruleEquity)}
                    </div>

                    <div className="mt-1 truncate text-[12px] font-medium leading-tight text-zinc-500">
                      of {formatMoney(profitTargetBalance)} goal
                    </div>
                  </div>
                </div>

                <div className="relative mt-auto pt-2">
                  <GoalProgressBar
                    value={goalProgress}
                    failedFinal={isAccountFailed && goalProgress > 0}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-0 lg:gap-3">
          <div className="pr-1.5 lg:pr-0">
            <RuleRoomCard
              title="Daily loss"
              room={dailyRoom}
              limit={dailyLossLimit}
              isAccountFailed={isAccountFailed}
            />
          </div>

          <div className="pl-1.5 lg:pl-0">
            <RuleRoomCard
              title="Total loss"
              room={totalRoom}
              limit={totalLossLimit}
              isAccountFailed={isAccountFailed}
            />
          </div>
        </section>

        <section className="mt-10">
          <AccountPositionsTable openBets={openBets} pastBets={pastBets} />
        </section>

        <section className="mt-10 min-h-[72px] rounded-2xl bg-zinc-950/70 p-4 ring-1 ring-zinc-900">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">
            Account ID
          </div>

          <div className="mt-2 break-all text-[13px] text-zinc-400">
            {account.id}
          </div>
        </section>
      </div>
    </div>
  );
}