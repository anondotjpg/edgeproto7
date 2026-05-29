"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

type AccountJoin = {
  account_name: string | null;
  plan_key: string;
  plan_size: number;
} | null;

type BetStatus = "open" | "won" | "lost" | "void" | "cashed_out";

type Bet = {
  id: string;
  account_id: string;
  game_id: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  stake: number;
  potential_profit: number;
  potential_payout: number;
  status: BetStatus;
  result: BetStatus | null;
  settlement_amount: number | null;
  placed_at: string;
  settled_at: string | null;
  challenge_accounts: AccountJoin;

  polymarket_condition_id?: string | null;
  polymarket_token_id?: string | null;
  polymarket_outcome?: string | null;
  polymarket_synced_at?: string | null;
  polymarket_winning_token_id?: string | null;
  polymarket_winning_outcome?: string | null;
  polymarket_resolution_error?: string | null;
};

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatMoney(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  const formatted = new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatted} EST`;
}

function formatCompactAccountSize(value: number | null | undefined) {
  const size = Number(value ?? 0);

  if (!size) return "";

  if (size >= 1000) {
    return `${Math.round(size / 1000)}k`;
  }

  return String(size);
}

function getAccountLabel(bet: Bet) {
  const accountName = bet.challenge_accounts?.account_name?.trim();

  if (accountName) return accountName;

  const size = bet.challenge_accounts?.plan_size;
  const compactSize = formatCompactAccountSize(size);

  if (!compactSize) return "Account";

  return `${compactSize} Account`;
}

function resultLabel(status: string) {
  if (status === "open") return "Open";
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  if (status === "void") return "Void";
  if (status === "cashed_out") return "Cashed Out";
  return status;
}

function getBetPnl(bet: Bet) {
  if (bet.status === "won") return Number(bet.potential_profit);
  if (bet.status === "lost") return -Number(bet.stake);
  if (bet.status === "void") return 0;

  if (bet.status === "cashed_out") {
    return Number(bet.settlement_amount ?? 0) - Number(bet.stake);
  }

  return null;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-900 ${className}`} />;
}

function StatsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 grid h-[56px] grid-cols-3 gap-3 overflow-hidden sm:mb-8 sm:h-[62px] sm:gap-4">
      {children}
    </div>
  );
}

function StatShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="h-[56px] overflow-hidden sm:h-[62px]">
      <div className="h-4 text-[9px] uppercase leading-4 tracking-[0.14em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
        {label}
      </div>

      <div className="mt-1.5 flex h-9 items-start overflow-hidden sm:mt-2 sm:h-10">
        {children}
      </div>
    </div>
  );
}

function StatSkeleton({
  label,
  variant = "short",
}: {
  label: string;
  variant?: "short" | "money";
}) {
  return (
    <StatShell label={label}>
      {variant === "money" ? (
        <SkeletonBlock className="mt-[1px] h-[28px] w-[118px] sm:h-[34px] sm:w-[150px]" />
      ) : (
        <SkeletonBlock className="mt-[1px] h-[28px] w-[28px] sm:h-[34px] sm:w-[36px]" />
      )}
    </StatShell>
  );
}

function StatItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <StatShell label={label}>
      <div className="h-[29px] text-[29px] font-semibold leading-none text-zinc-100 sm:h-[36px] sm:text-3xl">
        {value}
      </div>
    </StatShell>
  );
}

function DetailSkeleton({ label, width }: { label: string; width: string }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3">
      <div className="text-[11px] text-zinc-600">{label}</div>
      <SkeletonBlock className={`mt-2 h-4 ${width}`} />
    </div>
  );
}

function BetCardSkeleton({ active }: { active?: boolean }) {
  return (
    <div className="rounded-[22px] bg-zinc-950/80 p-4 ring-1 ring-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="mt-2 h-3 w-32" />
          <SkeletonBlock className="mt-2 h-3 w-16" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SkeletonBlock className="h-7 w-16 rounded-full" />
          {active ? <SkeletonBlock className="h-7 w-14 rounded-xl" /> : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <DetailSkeleton label="Odds" width="w-12" />
        <DetailSkeleton label="Stake" width="w-14" />
        <DetailSkeleton label="Payout" width="w-16" />
      </div>

      {!active ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <DetailSkeleton label="Settled" width="w-16" />
          <DetailSkeleton label="P/L" width="w-14" />
        </div>
      ) : null}

      <SkeletonBlock className="mt-4 h-3 w-32" />
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <>
      <StatsGrid>
        <StatSkeleton label="Active" />
        <StatSkeleton label="Past" />
        <StatSkeleton label="Risk" variant="money" />
      </StatsGrid>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Active Positions
          </h2>

          <div className="hidden text-sm text-zinc-500 sm:block">
            <SkeletonBlock className="inline-block h-4 w-28 align-middle" />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <BetCardSkeleton active />
          <BetCardSkeleton active />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-100">
          Past Positions
        </h2>

        <div className="grid gap-3 lg:grid-cols-2">
          <BetCardSkeleton />
          <BetCardSkeleton />
        </div>
      </section>
    </>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-6">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
        {title}
      </h3>

      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <div className="shrink-0 rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      {resultLabel(status)}
    </div>
  );
}

function SyncButton({
  onClick,
  disabled,
  isSyncing,
}: {
  onClick: () => void;
  disabled: boolean;
  isSyncing?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-xl border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSyncing ? "Syncing" : "Sync"}
    </button>
  );
}

function BetCard({
  bet,
  active,
  onSyncPolymarket,
  isSyncing,
}: {
  bet: Bet;
  active?: boolean;
  onSyncPolymarket?: (betId: string) => Promise<void>;
  isSyncing?: boolean;
}) {
  const pnl = getBetPnl(bet);
  const displayStatus = bet.result ?? bet.status;
  const hasPolymarketData = Boolean(bet.polymarket_condition_id);

  return (
    <div className="rounded-[22px] border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/accounts/${bet.account_id}`}
            className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {getAccountLabel(bet)}
          </Link>

          <h3 className="mt-2 truncate text-[21px] font-semibold leading-tight tracking-tight text-zinc-100">
            {bet.selection}
          </h3>

          <p className="mt-0.5 text-sm text-zinc-500">
            {bet.league.toUpperCase()}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={displayStatus} />

          {active && onSyncPolymarket ? (
            <SyncButton
              onClick={() => onSyncPolymarket(bet.id)}
              disabled={Boolean(isSyncing) || !hasPolymarketData}
              isSyncing={isSyncing}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3">
        <DetailItem label="Odds" value={formatOdds(Number(bet.odds))} />
        <DetailItem label="Stake" value={formatMoney(bet.stake)} />
        <DetailItem label="Payout" value={formatMoney(bet.potential_payout)} />
      </div>

      {!active ? (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3">
          <DetailItem
            label="Settled"
            value={formatMoney(bet.settlement_amount)}
          />
          <DetailItem label="P/L" value={pnl === null ? "—" : formatMoney(pnl)} />
        </div>
      ) : null}

      {bet.polymarket_winning_outcome ? (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <DetailItem
            label="Polymarket Result"
            value={bet.polymarket_winning_outcome}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <div className="text-[12px] text-zinc-500">
          {active ? "Placed" : "Settled"}{" "}
          {formatDate(active ? bet.placed_at : bet.settled_at)}
        </div>

        {active && bet.polymarket_synced_at ? (
          <div className="text-[12px] text-zinc-600">
            Synced {formatDate(bet.polymarket_synced_at)}
          </div>
        ) : null}
      </div>

      {active && bet.polymarket_resolution_error ? (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 p-3 text-[12px] text-zinc-500">
          {bet.polymarket_resolution_error}
        </div>
      ) : null}
    </div>
  );
}

export default function PortfolioClient() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();

  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [pastBets, setPastBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingBetId, setSyncingBetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentMinHeight, setContentMinHeight] = useState<number | null>(null);

  const hasAnyBets = openBets.length > 0 || pastBets.length > 0;

  const totals = useMemo(() => {
    const activeRisk = openBets.reduce(
      (sum, bet) => sum + Number(bet.stake ?? 0),
      0
    );

    const possiblePayout = openBets.reduce(
      (sum, bet) => sum + Number(bet.potential_payout ?? 0),
      0
    );

    return {
      activeCount: openBets.length,
      pastCount: pastBets.length,
      activeRisk,
      possiblePayout,
    };
  }, [openBets, pastBets]);

  async function loadPortfolio(options?: { silent?: boolean }) {
    if (!ready) return;

    if (!authenticated) {
      setOpenBets([]);
      setPastBets([]);
      setLoading(false);
      return;
    }

    try {
      if (!options?.silent) {
        setLoading(true);
      }

      setError(null);

      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Missing auth token.");
      }

      const response = await fetch("/api/portfolio/mine", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load portfolio.");
      }

      setOpenBets(data.openBets ?? []);
      setPastBets(data.pastBets ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to load portfolio.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function syncPolymarketBet(betId: string) {
    if (syncingBetId) return;

    try {
      setSyncingBetId(betId);
      setError(null);

      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Missing auth token.");
      }

      const response = await fetch("/api/bets/sync-polymarket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ betId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError(data?.reason || "Market has not resolved on Polymarket yet.");

          await loadPortfolio({ silent: true });
          return;
        }

        throw new Error(data?.error || "Unable to sync Polymarket result.");
      }

      await loadPortfolio({ silent: true });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to sync Polymarket result."
      );

      await loadPortfolio({ silent: true });
    } finally {
      setSyncingBetId(null);
    }
  }

  useLayoutEffect(() => {
    if (!ready || loading) {
      const height = contentRef.current?.getBoundingClientRect().height;

      if (height) {
        setContentMinHeight((current) =>
          Math.max(current ?? 0, Math.ceil(height))
        );
      }
    }
  }, [ready, loading]);

  useEffect(() => {
    loadPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 pb-24 sm:px-6 md:py-10">
      <div className="mb-7 sm:mb-8">
        <h1 className="text-[34px] font-semibold tracking-tight text-zinc-100">
          Portfolio
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          View active and past positions across your accounts.
        </p>
      </div>

      <div
        ref={contentRef}
        style={contentMinHeight ? { minHeight: contentMinHeight } : undefined}
      >
        {!ready || loading ? (
          <PortfolioSkeleton />
        ) : !authenticated ? (
          <EmptyState
            title="Sign in to view your portfolio"
            description="Your active and past positions will appear here once you sign in."
            action={
              <button
                type="button"
                onClick={login}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950"
              >
                Sign in
              </button>
            }
          />
        ) : (
          <>
            {error ? (
              <div className="mb-5 rounded-[20px] border border-red-950 bg-red-950/20 p-4 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <StatsGrid>
              <StatItem label="Active" value={totals.activeCount} />
              <StatItem label="Past" value={totals.pastCount} />
              <StatItem label="Risk" value={formatMoney(totals.activeRisk)} />
            </StatsGrid>

            {!hasAnyBets ? (
              <EmptyState
                title="No positions yet"
                description="Once you place a bet from an event page, active positions will show here. Settled bets will move into your past positions."
                action={
                  <Link
                    href="/"
                    className="inline-flex rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                  >
                    Browse markets
                  </Link>
                }
              />
            ) : (
              <>
                <section>
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
                      Active Positions
                    </h2>

                    <div className="text-sm text-zinc-500">
                      pot. payout: {formatMoney(totals.possiblePayout)}
                    </div>
                  </div>

                  {openBets.length ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {openBets.map((bet) => (
                        <BetCard
                          key={bet.id}
                          bet={bet}
                          active
                          onSyncPolymarket={syncPolymarketBet}
                          isSyncing={syncingBetId === bet.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No active positions"
                      description="You do not have any open bets right now. New bets will appear here until they settle."
                      action={
                        <Link
                          href="/"
                          className="inline-flex rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                        >
                          Browse markets
                        </Link>
                      }
                    />
                  )}
                </section>

                <section className="mt-10">
                  <h2 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-100">
                    Past Positions
                  </h2>

                  {pastBets.length ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {pastBets.map((bet) => (
                        <BetCard key={bet.id} bet={bet} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No past positions"
                      description="Settled wins, losses, and voids will appear here after positions close."
                    />
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}