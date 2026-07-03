"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { RiCheckboxCircleLine, RiHandCoinLine } from "react-icons/ri";
import { toast } from "sonner";

const MIN_PAYOUT_PNL = 2000;

type Account = {
  id: string;
  account_name: string | null;
  plan_size: number;
  status: string;

  funded_starting_balance: number | null;
  funded_current_balance: number | null;
  funded_reserved_risk: number | null;
  funded_realized_pnl: number | null;
};

function formatMoney(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedMoney(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  const sign = safe > 0 ? "+" : safe < 0 ? "-" : "";

  return `${sign}${formatMoney(Math.abs(safe))}`;
}

function formatCompactAccountSize(value: number | null | undefined) {
  const size = Number(value ?? 0);
  if (!size) return "Account";
  if (size >= 1000) return `${Math.round(size / 1000)}k Account`;
  return `${size} Account`;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-900 ${className}`} />;
}

function getStaggeredTableRowBg(index: number) {
  if (index % 3 === 0) return "bg-zinc-950/80";
  if (index % 3 === 1) return "bg-zinc-900/35";
  return "bg-zinc-900/20";
}

function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] pb-24 text-white md:pb-0">
      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-20 sm:px-6 md:py-15 md:pb-24">
        <div className="mb-2 sm:mb-3">
          <div className="flex h-[36px] max-w-full items-start overflow-hidden sm:h-[42px] lg:h-[44px]">
            <h1 className="overflow-visible truncate text-[29px] font-semibold leading-[1.08] tracking-tight text-zinc-100 sm:text-[34px] lg:text-[36px]">
              Payouts
            </h1>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

function FundedAccountsTableHeader() {
  const labels = ["Account", "Equity", "Available", "P/L", ""];

  return (
    <div className="hidden rounded-t-2xl border-b border-zinc-900 bg-black/20 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_140px_140px_120px_44px] lg:items-center lg:gap-3">
      {labels.map((label, index) => (
        <div
          key={label || "action"}
          className={index >= 3 ? "text-right" : "text-left"}
        >
          {label}
        </div>
      ))}
    </div>
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
    <div className="flex min-h-[154px] flex-col justify-center bg-zinc-950/70 text-left">
      <div className="text-[17px] font-semibold tracking-tight text-zinc-100">
        {title}
      </div>

      <p className="mt-2 max-w-xl text-[14px] leading-6 text-zinc-500">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function EmptyFundedAccountsRow() {
  return (
    <div className="rounded-2xl border-b border-zinc-900/80 px-3 py-3 last:border-b-0 sm:px-5 lg:rounded-t-none">
      <EmptyState
        title="No funded accounts yet"
        description="Pass a challenge to unlock funded payouts. Then info will show here."
        action={
          <Link
            href="/accounts"
            className="inline-flex rounded-xl bg-black/30 px-4 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            Start challenge
          </Link>
        }
      />
    </div>
  );
}

function PayoutSummarySkeleton() {
  return (
    <section className="mb-4 sm:mb-5">
      <div className="text-[13px] font-medium text-zinc-500">
        Total funded P/L
      </div>

      <div className="mt-2 h-[42px] overflow-hidden">
        <SkeletonBlock className="h-[42px] w-44" />
      </div>
    </section>
  );
}

function PayoutSummary({ totalFundedPnl }: { totalFundedPnl: number }) {
  return (
    <section className="mb-4 sm:mb-5">
      <div className="text-[13px] font-medium text-zinc-500">
        Total funded P/L
      </div>

      <div className="mt-2 h-[42px] overflow-hidden">
        <div
          className={[
            "text-[42px] font-semibold leading-none tracking-tight",
            totalFundedPnl > 0
              ? "text-green-500"
              : totalFundedPnl < 0
                ? "text-red-400"
                : "text-zinc-100",
          ].join(" ")}
        >
          {formatSignedMoney(totalFundedPnl)}
        </div>
      </div>
    </section>
  );
}

function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
    />
  );
}

function PayoutRequestButton({
  pnl,
  requesting,
  submitted,
  onRequest,
}: {
  accountName: string;
  pnl: number;
  requesting: boolean;
  submitted: boolean;
  onRequest: () => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const eligible = pnl >= MIN_PAYOUT_PNL;
  const disabled = !eligible || requesting || submitted;
  const tooltipLabel = submitted
    ? "Request sent"
    : eligible
      ? "Request payout"
      : `${formatMoney(MIN_PAYOUT_PNL)} P/L required`;

  return (
    <div
      className="relative isolate z-50 ml-auto flex w-fit overflow-visible"
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
    >
      <button
        type="button"
        aria-label={tooltipLabel}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (disabled) return;

          onRequest();
        }}
        className={[
          "grid h-9 w-9 place-items-center rounded-xl transition-colors",
          submitted
            ? "cursor-not-allowed text-green-500"
            : disabled
              ? "cursor-not-allowed text-zinc-600"
              : "cursor-pointer text-green-400 hover:text-green-300",
        ].join(" ")}
      >
        {requesting ? (
          <ButtonSpinner />
        ) : submitted ? (
          <RiCheckboxCircleLine className="h-[18px] w-[18px]" />
        ) : (
          <RiHandCoinLine className="h-[18px] w-[18px]" />
        )}
      </button>

      <div
        className={[
          "pointer-events-none absolute bottom-[calc(100%+7px)] right-0 z-[999] w-max whitespace-nowrap rounded-lg border border-zinc-800/90 bg-zinc-950/95 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-zinc-200 shadow-xl shadow-black/50 backdrop-blur-sm transition-opacity duration-125 ease-out",
          tooltipOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {tooltipLabel}
      </div>
    </div>
  );
}

function PayoutsSkeleton() {
  return (
    <PageLayout>
      <PayoutSummarySkeleton />

      <section className="relative isolate overflow-visible rounded-2xl bg-zinc-950/80 shadow-sm">
        <div className="pointer-events-none absolute inset-0 z-40 rounded-2xl border border-zinc-900" />
        <div className="relative overflow-visible rounded-2xl">
          <FundedAccountsTableHeader />

          {[1, 2, 3].map((row, index) => (
            <div
              key={row}
              className={[
                "border-b border-zinc-900/80 px-4 py-4 first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_140px_140px_120px_44px] lg:items-center lg:gap-3 lg:first:rounded-t-none",
                getStaggeredTableRowBg(index),
              ].join(" ")}
            >
              <div>
                <SkeletonBlock className="h-4 w-40" />
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(86px,1fr)_40px] gap-3 overflow-visible lg:mt-0 lg:contents">
                <div>
                  <SkeletonBlock className="h-3 w-14 lg:hidden" />
                  <SkeletonBlock className="mt-2 h-4 w-20 lg:mt-0" />
                </div>

                <div>
                  <SkeletonBlock className="h-3 w-20 lg:hidden" />
                  <SkeletonBlock className="mt-2 h-4 w-20 lg:mt-0" />
                </div>

                <div className="text-right">
                  <SkeletonBlock className="ml-auto h-3 w-10 lg:hidden" />
                  <SkeletonBlock className="ml-auto mt-2 h-4 w-20 lg:mt-0" />
                </div>

                <div className="flex items-end justify-end lg:items-center">
                  <SkeletonBlock className="h-5 w-5 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}

export default function PayoutsPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingAccountIds, setRequestingAccountIds] = useState<string[]>(
    [],
  );
  const [submittedAccountIds, setSubmittedAccountIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadAccounts() {
      if (!ready) return;

      if (!authenticated) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const token = await getAccessToken();

        const res = await fetch("/api/accounts/mine", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Unable to load accounts.");
        }

        setAccounts(data.accounts ?? []);
      } catch (error) {
        console.error(error);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    }

    loadAccounts();
  }, [ready, authenticated, getAccessToken]);

  const fundedAccounts = useMemo(() => {
    return accounts.filter((account) => account.status === "funded");
  }, [accounts]);

  const totalFundedPnl = fundedAccounts.reduce((sum, account) => {
    return sum + Number(account.funded_realized_pnl ?? 0);
  }, 0);

  async function requestPayout(account: Account) {
    const pnl = Number(account.funded_realized_pnl ?? 0);
    const accountName =
      account.account_name?.trim() ||
      formatCompactAccountSize(account.plan_size);

    if (pnl < MIN_PAYOUT_PNL) {
      toast.info("Payout not available yet", {
        description: `P/L must be at least ${formatMoney(
          MIN_PAYOUT_PNL,
        )} to request a payout.`,
      });
      return;
    }

    try {
      setRequestingAccountIds((current) =>
        current.includes(account.id) ? current : [...current, account.id],
      );

      const token = await getAccessToken();

      const res = await fetch("/api/payouts/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ accountId: account.id }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.code === "PAYOUT_ALREADY_REQUESTED") {
          setSubmittedAccountIds((current) =>
            current.includes(account.id) ? current : [...current, account.id],
          );
        }

        throw new Error(data?.error || "Unable to request payout.");
      }

      setSubmittedAccountIds((current) =>
        current.includes(account.id) ? current : [...current, account.id],
      );

      toast.success("Payout requested", {
        description: `${accountName} • ${formatSignedMoney(pnl)}`,
      });
    } catch (error) {
      toast.error("Payout request failed", {
        description:
          error instanceof Error ? error.message : "Unable to request payout.",
      });
    } finally {
      setRequestingAccountIds((current) =>
        current.filter((accountId) => accountId !== account.id),
      );
    }
  }

  if (!ready || loading) {
    return <PayoutsSkeleton />;
  }

  if (!authenticated) {
    return (
      <PageLayout>
        <EmptyState
          title="Sign in to view funded payouts"
          description="Your funded account balances and payout performance will appear here once you sign in."
          action={
            <button
              type="button"
              onClick={login}
              className="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              Sign in
            </button>
          }
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PayoutSummary totalFundedPnl={totalFundedPnl} />

      <section className="relative isolate overflow-visible rounded-2xl bg-zinc-950/80 shadow-sm">
        <div className="pointer-events-none absolute inset-0 z-40 rounded-2xl border border-zinc-900" />
        <div className="relative overflow-visible rounded-2xl">
          <FundedAccountsTableHeader />

          <div>
            {fundedAccounts.length ? (
              fundedAccounts.map((account, index) => {
                const accountName =
                  account.account_name?.trim() ||
                  formatCompactAccountSize(account.plan_size);

                const fundedEquity =
                  Number(account.funded_current_balance ?? 0) +
                  Number(account.funded_reserved_risk ?? 0);

                const pnl = Number(account.funded_realized_pnl ?? 0);

                return (
                  <div
                    key={account.id}
                    className={[
                      "relative overflow-visible border-b border-zinc-900/80 px-4 py-4 first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 hover:z-50 hover:bg-zinc-900/40 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_140px_140px_120px_44px] lg:items-center lg:gap-3 lg:first:rounded-t-none",
                      getStaggeredTableRowBg(index),
                    ].join(" ")}
                  >
                    <Link
                      href={`/accounts/${account.id}`}
                      className="min-w-0 transition-colors hover:text-white"
                    >
                      <div className="truncate text-[15px] font-semibold text-zinc-100">
                        {accountName}
                      </div>
                    </Link>

                    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(86px,1fr)_40px] gap-3 overflow-visible lg:mt-0 lg:contents">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
                          Equity
                        </div>
                        <div className="mt-1 truncate text-[14px] font-semibold text-zinc-100 lg:mt-0 lg:text-base">
                          {formatMoney(fundedEquity)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
                          Available
                        </div>
                        <div className="mt-1 truncate text-[14px] font-semibold text-zinc-100 lg:mt-0 lg:text-base">
                          {formatMoney(account.funded_current_balance)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
                          P/L
                        </div>
                        <div
                          className={[
                            "mt-1 truncate text-[14px] font-semibold lg:mt-0 lg:text-base",
                            pnl > 0
                              ? "text-green-500"
                              : pnl < 0
                                ? "text-red-400"
                                : "text-zinc-100",
                          ].join(" ")}
                        >
                          {formatSignedMoney(pnl)}
                        </div>
                      </div>

                      <div className="relative overflow-visible flex items-end justify-end lg:items-center">
                        <PayoutRequestButton
                          accountName={accountName}
                          pnl={pnl}
                          requesting={requestingAccountIds.includes(account.id)}
                          submitted={submittedAccountIds.includes(account.id)}
                          onRequest={() => requestPayout(account)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyFundedAccountsRow />
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}