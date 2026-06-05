"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

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
  placed_at: string;
  settled_at: string | null;
  team_logo: string | null;
  team_logo_alt: string | null;
  polymarket_winning_outcome: string | null;
  polymarket_resolution_error: string | null;
};

type PositionsView = "open" | "past";

const POSITIONS_TABS: { label: string; value: PositionsView }[] = [
  { label: "Open", value: "open" },
  { label: "Past", value: "past" },
];

function formatMoney(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function formatOdds(odds: number | null | undefined) {
  const safeOdds = Number(odds ?? 0);
  return safeOdds > 0 ? `+${safeOdds}` : `${safeOdds}`;
}

function resultLabel(status: string) {
  if (status === "open") return "Open";
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  if (status === "void") return "Void";
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  if (status === "active_dev") return "Active";
  if (status === "active") return "Active";
  return status;
}

function getBetPnl(bet: BetRow) {
  if (bet.status === "won") return Number(bet.potential_profit ?? 0);
  if (bet.status === "lost") return -Number(bet.stake ?? 0);
  if (bet.status === "void") return 0;
  return null;
}

function getBetRowClassName(index: number) {
  const tint =
    index % 3 === 0
      ? "bg-zinc-950/80"
      : index % 3 === 1
        ? "bg-zinc-900/35"
        : "bg-zinc-900/20";

  return [
    "border-b border-zinc-900/80 px-3 py-4 text-sm last:border-b-0 sm:px-5 sm:py-3.5 lg:py-3",
    "transition-colors hover:bg-zinc-900/55",
    tint,
  ].join(" ");
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

function StatusText({ status }: { status: string }) {
  return (
    <div className="text-sm font-medium text-zinc-400">
      {resultLabel(status)}
    </div>
  );
}

function TeamLogo({ bet }: { bet: BetRow }) {
  if (bet.team_logo) {
    return (
      <img
        src={bet.team_logo}
        alt={bet.team_logo_alt || bet.selection}
        className="h-11 w-11 shrink-0 rounded-lg object-contain lg:h-9 lg:w-9"
      />
    );
  }

  return <div className="h-11 w-11 shrink-0 rounded-lg bg-zinc-900 lg:h-9 lg:w-9" />;
}

function TeamCell({ bet }: { bet: BetRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TeamLogo bet={bet} />

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-zinc-100">
          {bet.selection}
        </div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
          {bet.league}
        </div>
      </div>
    </div>
  );
}

function MobileBetTop({ bet }: { bet: BetRow }) {
  return (
    <div className="flex min-w-0 items-start gap-3.5">
      <TeamLogo bet={bet} />

      <div className="min-w-0 flex-1 pr-2">
        <div className="h-6 truncate text-[17px] font-semibold leading-6 text-zinc-100">
          {bet.selection}
        </div>

        <div className="mt-1 h-5 truncate text-[13px] font-medium leading-5 text-zinc-500">
          {bet.league?.toUpperCase()}
        </div>
      </div>

      <div className="mt-0.5 h-6 shrink-0 text-right text-[20px] font-semibold leading-6 text-zinc-100">
        {formatOdds(Number(bet.odds))}
      </div>
    </div>
  );
}

function MobileValueGrid({
  status,
  stake,
  result,
  resultLabel,
  resultTone = "neutral",
}: {
  status: string;
  stake: string;
  result: string;
  resultLabel: string;
  resultTone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="mt-3 flex justify-end pl-[58px]">
      <div className="grid w-full max-w-[250px] grid-cols-3 gap-2.5 text-right">
        <div>
          <div className="h-3.5 truncate text-[11px] font-medium uppercase leading-[14px] tracking-[0.14em] text-zinc-600">
            Status
          </div>
          <div className="mt-2 h-6 truncate text-[15px] font-semibold leading-6 text-zinc-400">
            {status}
          </div>
        </div>

        <div>
          <div className="h-3.5 truncate text-[11px] font-medium uppercase leading-[14px] tracking-[0.14em] text-zinc-600">
            Stake
          </div>
          <div className="mt-2 h-6 truncate text-[15px] font-semibold leading-6 text-zinc-100">
            {stake}
          </div>
        </div>

        <div>
          <div className="h-3.5 truncate text-[11px] font-medium uppercase leading-[14px] tracking-[0.14em] text-zinc-600">
            {resultLabel}
          </div>
          <div
            className={[
              "mt-2 h-6 truncate text-[15px] font-semibold leading-6",
              resultTone === "positive"
                ? "text-green-500"
                : resultTone === "negative"
                  ? "text-red-400"
                  : "text-zinc-100",
            ].join(" ")}
          >
            {result}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableHeader({ labels }: { labels: string[] }) {
  return (
    <div className="hidden min-w-[640px] grid-cols-[minmax(220px,1fr)_86px_86px_104px_116px] border-b border-zinc-900 bg-black/20 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:grid lg:px-5">
      {labels.map((label, index) => (
        <div key={label} className={index >= 2 ? "text-right" : "text-left"}>
          {label}
        </div>
      ))}
    </div>
  );
}

function EmptyTableRow({ message }: { message: string }) {
  return (
    <div className="border-b border-zinc-900/80 px-4 py-8 text-sm text-zinc-500 last:border-b-0 sm:px-5 lg:min-w-[640px]">
      {message}
    </div>
  );
}

function EmptyOpenPositionsRow() {
  return (
    <div className="border-b border-zinc-900/80 px-3 py-3 last:border-b-0 sm:px-5 lg:min-w-[640px]">
      <EmptyState
        title="No open positions"
        description="This account has no active bets right now. New positions will appear here after a bet is placed."
        action={
          <Link
            href="/"
            className="inline-flex rounded-xl bg-black/30 px-4 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            Browse markets
          </Link>
        }
      />
    </div>
  );
}

function ActiveBetRow({ bet, index }: { bet: BetRow; index: number }) {
  const displayStatus = bet.result ?? bet.status;

  return (
    <div className={getBetRowClassName(index)}>
      <div className="lg:hidden">
        <MobileBetTop bet={bet} />
        <MobileValueGrid
          status={resultLabel(displayStatus)}
          stake={formatMoneyInteger(bet.stake)}
          result={formatMoney(bet.potential_payout)}
          resultLabel="Payout"
        />
      </div>

      <div className="hidden min-w-[640px] grid-cols-[minmax(220px,1fr)_86px_86px_104px_116px] items-center lg:grid">
        <TeamCell bet={bet} />

        <StatusText status={displayStatus} />

        <div className="text-right font-semibold text-zinc-100">
          {formatOdds(Number(bet.odds))}
        </div>

        <div className="text-right font-semibold text-zinc-100">
          {formatMoneyInteger(bet.stake)}
        </div>

        <div className="text-right font-semibold text-zinc-100">
          {formatMoney(bet.potential_payout)}
        </div>
      </div>
    </div>
  );
}

function PastBetRow({ bet, index }: { bet: BetRow; index: number }) {
  const pnl = getBetPnl(bet);
  const displayStatus = bet.result ?? bet.status;
  const pnlNumber = Number(pnl ?? 0);
  const pnlTone =
    pnlNumber > 0 ? "positive" : pnlNumber < 0 ? "negative" : "neutral";

  return (
    <div className={getBetRowClassName(index)}>
      <div className="lg:hidden">
        <MobileBetTop bet={bet} />
        <MobileValueGrid
          status={resultLabel(displayStatus)}
          stake={formatMoneyInteger(bet.stake)}
          result={pnl === null ? "—" : formatSignedMoney(pnl)}
          resultLabel="P/L"
          resultTone={pnlTone}
        />
      </div>

      <div className="hidden min-w-[640px] grid-cols-[minmax(220px,1fr)_86px_86px_104px_116px] items-center lg:grid">
        <TeamCell bet={bet} />

        <StatusText status={displayStatus} />

        <div className="text-right font-semibold text-zinc-100">
          {formatOdds(Number(bet.odds))}
        </div>

        <div className="text-right font-semibold text-zinc-100">
          {formatMoneyInteger(bet.stake)}
        </div>

        <div
          className={[
            "text-right font-semibold",
            pnlTone === "positive"
              ? "text-green-500"
              : pnlTone === "negative"
                ? "text-red-400"
                : "text-zinc-100",
          ].join(" ")}
        >
          {pnl === null ? "—" : formatSignedMoney(pnl)}
        </div>
      </div>
    </div>
  );
}

function PositionsSegmentedControl({
  selectedView,
  onChange,
}: {
  selectedView: PositionsView;
  onChange: (view: PositionsView) => void;
}) {
  return (
    <div className="mb-3 flex items-center">
      <div className="relative z-20 inline-flex h-10 w-fit items-center rounded-lg bg-zinc-900/70">
        {POSITIONS_TABS.map((tab) => {
          const active = selectedView === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={[
                "relative flex h-10 min-w-[62px] cursor-pointer items-center justify-center rounded-lg px-3.5 text-[13px] font-medium transition-colors",
                active ? "text-zinc-100" : "text-zinc-300 hover:text-zinc-100",
              ].join(" ")}
            >
              {active ? (
                <motion.span
                  layoutId="account-positions-segment-active"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 m-[3px] rounded-lg bg-zinc-800"
                />
              ) : null}

              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountPositionsTable({
  openBets,
  pastBets,
}: {
  openBets: BetRow[];
  pastBets: BetRow[];
}) {
  const [selectedView, setSelectedView] = useState<PositionsView>("open");
  const showingOpen = selectedView === "open";

  return (
    <div>
      <PositionsSegmentedControl
        selectedView={selectedView}
        onChange={setSelectedView}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selectedView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80 shadow-sm lg:overflow-x-auto"
        >
          {showingOpen ? (
            <>
              <TableHeader labels={["Team", "Status", "Odds", "Stake", "Payout"]} />
              {openBets.length ? (
                openBets.map((bet, index) => (
                  <ActiveBetRow key={bet.id} bet={bet} index={index} />
                ))
              ) : (
                <EmptyOpenPositionsRow />
              )}
            </>
          ) : (
            <>
              <TableHeader labels={["Team", "Status", "Odds", "Stake", "P/L"]} />
              {pastBets.length ? (
                pastBets.map((bet, index) => (
                  <PastBetRow key={bet.id} bet={bet} index={index} />
                ))
              ) : (
                <EmptyTableRow message="No past positions." />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}