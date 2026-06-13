"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

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

function FundedAccountsTableHeader() {
  const labels = ["Account", "Equity", "Available", "P/L"];

  return (
    <div className="hidden border-b border-zinc-900 bg-black/20 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 sm:px-5 lg:grid lg:grid-cols-[1fr_140px_140px_120px] lg:items-center lg:gap-3">
      {labels.map((label, index) => (
        <div
          key={label}
          className={index === labels.length - 1 ? "text-right" : "text-left"}
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
    <div className="border-b border-zinc-900/80 px-3 py-3 last:border-b-0 sm:px-5">
      <EmptyState
        title="No funded accounts yet"
        description="Pass a challenge to unlock funded payouts."
        action={
          <Link
            href="/accounts"
            className="inline-flex rounded-xl bg-black/30 px-4 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            Start a challenge
          </Link>
        }
      />
    </div>
  );
}

function PayoutsSkeleton() {
  return (
    <div className="min-h-screen bg-[#09090b] px-4 pt-20 pb-32 text-white sm:px-6 md:py-15 md:pb-24">
      <main className="mx-auto w-full max-w-7xl">
        <section className="mb-4">
          <div className="text-[13px] font-medium text-zinc-500">
            Total funded P/L
          </div>

          <div className="mt-2 h-[42px] overflow-hidden">
            <SkeletonBlock className="h-[42px] w-44" />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80">
          <FundedAccountsTableHeader />

          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="border-b border-zinc-900/80 px-4 py-4 last:border-b-0 sm:px-5 lg:grid lg:grid-cols-[1fr_140px_140px_120px] lg:items-center lg:gap-3"
            >
              <div>
                <SkeletonBlock className="h-4 w-40" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 lg:mt-0 lg:contents">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
                    Equity
                  </div>
                  <SkeletonBlock className="mt-2 h-4 w-20 lg:mt-0" />
                </div>

                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
                    Available
                  </div>
                  <SkeletonBlock className="mt-2 h-4 w-20 lg:mt-0" />
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
                    P/L
                  </div>
                  <SkeletonBlock className="mt-2 ml-auto h-4 w-20 lg:mt-0" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default function PayoutsPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!ready || loading) {
    return <PayoutsSkeleton />;
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 text-white">
        <section className="mx-auto flex w-full max-w-4xl -translate-y-6 flex-col items-center text-center">
          <h1 className="text-[68px] font-bold leading-[0.9] tracking-[-0.06em] text-zinc-100 sm:text-[92px] lg:text-[124px]">
            Lock in.
          </h1>

          <p className="mt-4 mx-[7%] max-w-2xl text-[22px] font-medium leading-[1.25] tracking-tight text-zinc-500 sm:text-[28px] lg:text-[34px]">
            Sign in to view funded payouts.
          </p>

          <button
            type="button"
            onClick={login}
            className="mt-8 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950"
          >
            Sign in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] px-4 pt-20 pb-32 text-white sm:px-6 md:py-15 md:pb-24">
      <main className="mx-auto w-full max-w-7xl">
        <section className="mb-4">
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

        <section className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80">
          <FundedAccountsTableHeader />

          <div>
            {fundedAccounts.length ? (
              fundedAccounts.map((account) => {
                const accountName =
                  account.account_name?.trim() ||
                  formatCompactAccountSize(account.plan_size);

                const fundedEquity =
                  Number(account.funded_current_balance ?? 0) +
                  Number(account.funded_reserved_risk ?? 0);

                const pnl = Number(account.funded_realized_pnl ?? 0);

                return (
                  <Link
                    key={account.id}
                    href={`/accounts/${account.id}`}
                    className="block border-b border-zinc-900/80 px-4 py-4 last:border-b-0 hover:bg-zinc-900/40 sm:px-5 lg:grid lg:grid-cols-[1fr_140px_140px_120px] lg:items-center lg:gap-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-zinc-100">
                        {accountName}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 lg:mt-0 lg:contents">
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
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyFundedAccountsRow />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}