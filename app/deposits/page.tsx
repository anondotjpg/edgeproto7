"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { FiCheck, FiCopy } from "react-icons/fi";

type DepositView = "open" | "past";
type DepositChain = "solana" | "ethereum" | "bitcoin";
type DepositProvider = "relay" | "promo";

type DepositInvoiceStatus =
  | "pending"
  | "processing"
  | "paid"
  | "expired"
  | "refunded"
  | "failed"
  | "invalid"
  | "underpaid";

type DepositInvoice = {
  id: string;
  provider: DepositProvider;
  plan_key: string;
  chain: DepositChain;
  asset: "SOL" | "ETH" | "BTC";
  deposit_address: string;
  relay_deposit_address?: string | null;
  relay_request_id?: string | null;
  relay_status?: string | null;
  relay_trade_type?: string | null;

  expected_amount_display: string;
  expected_destination_amount_display?: string | null;
  quoted_destination_amount_display?: string | null;
  edge_min_destination_amount_display?: string | null;
  received_destination_amount_display?: string | null;

  destination_address?: string | null;
  status: DepositInvoiceStatus;
  expires_at: string;
  created_at: string;
  updated_at?: string | null;
  paid_at?: string | null;
  tx_hash?: string | null;
  confirmations?: number | null;

  credited_account_id?: string | null;
  credited_account_ids?: string[] | null;
  relay_in_tx_hashes?: string[] | null;
  relay_out_tx_hashes?: string[] | null;

  promo_code?: string | null;
  subtotal_amount_cents?: number | null;
  discount_amount_cents?: number | null;
  final_amount_cents?: number | null;
  account_quantity?: number | null;
};

type DepositsResponse = {
  deposits?: DepositInvoice[];
  error?: string;
  message?: string;
};

type CancelDepositResponse = {
  invoice?: DepositInvoice;
  error?: string;
  message?: string;
};

const DEPOSIT_TABS: { label: string; value: DepositView }[] = [
  { label: "Open", value: "open" },
  { label: "Past", value: "past" },
];

function getDesktopDepositGridClassName(
  showTimeLeft: boolean,
  showAction = true,
) {
  if (showTimeLeft) {
    return "min-w-[940px] grid-cols-[minmax(220px,1.15fr)_112px_112px_74px_112px_112px_168px]";
  }

  if (showAction) {
    return "min-w-[820px] grid-cols-[minmax(220px,1.15fr)_112px_112px_74px_112px_168px]";
  }

  return "min-w-[700px] grid-cols-[minmax(220px,1.15fr)_112px_112px_74px_112px]";
}

function getDepositRowTintClassName(index: number) {
  if (index % 3 === 0) return "bg-zinc-950/80";
  if (index % 3 === 1) return "bg-zinc-900/35";
  return "bg-zinc-900/20";
}

function getMobileDepositRowTintClassName(index: number) {
  return getDepositRowTintClassName(index);
}

function isOpenStatus(status: DepositInvoiceStatus) {
  return status === "pending" || status === "processing";
}

function isTerminalStatus(status: DepositInvoiceStatus) {
  return [
    "paid",
    "expired",
    "failed",
    "refunded",
    "invalid",
    "underpaid",
  ].includes(status);
}

function formatCents(cents: number | null | undefined) {
  const safeCents = Number(cents ?? 0);
  const dollars = safeCents / 100;
  const hasDecimalCents = safeCents % 100 !== 0;

  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasDecimalCents ? 2 : 0,
    maximumFractionDigits: hasDecimalCents ? 2 : 0,
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCompactPlan(planKey: string | null | undefined) {
  const planSize = Number(planKey ?? 0);

  if (!Number.isFinite(planSize) || planSize <= 0) return "Account";
  if (planSize >= 1000) return `${Math.round(planSize / 1000)}k Account`;

  return `${planSize} Account`;
}

function formatDepositShortId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function getStatusLabel(status: DepositInvoiceStatus) {
  if (status === "processing") return "Processing";
  if (status === "paid") return "Paid";
  if (status === "expired") return "Expired";
  if (status === "refunded") return "Refunded";
  if (status === "failed") return "Failed";
  if (status === "invalid") return "Invalid";
  if (status === "underpaid") return "Underpaid";
  return "Pending";
}

function getStatusClassName(status: DepositInvoiceStatus) {
  if (status === "paid") return "text-green-400";
  if (status === "underpaid" || status === "failed" || status === "invalid") {
    return "text-red-400";
  }
  if (status === "expired" || status === "refunded") return "text-zinc-500";
  if (status === "processing") return "text-zinc-200";
  return "text-zinc-300";
}

function formatRelayStatus(value: string | null | undefined) {
  const cleanValue = value?.trim();

  if (!cleanValue) return null;

  return cleanValue
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDepositTotal(invoice: DepositInvoice) {
  if (typeof invoice.final_amount_cents === "number") {
    return formatCents(invoice.final_amount_cents);
  }

  return "—";
}

function getDepositQuantity(invoice: DepositInvoice) {
  const quantity = Number(invoice.account_quantity ?? 1);

  if (!Number.isFinite(quantity) || quantity < 1) return 1;

  return Math.min(Math.max(Math.round(quantity), 1), 5);
}

function getOpenTimeLabel(invoice: DepositInvoice, nowMs: number) {
  if (invoice.status === "processing") return "Processing";

  const expiresAtMs = new Date(invoice.expires_at).getTime();

  if (!Number.isFinite(expiresAtMs)) return "—";

  const remainingMs = expiresAtMs - nowMs;

  if (remainingMs <= 0) return "Expired";

  return formatCountdown(remainingMs);
}

function sortDepositsByActivity(deposits: DepositInvoice[]) {
  return [...deposits].sort((a, b) => {
    const aTime = Date.parse(a.paid_at ?? a.updated_at ?? a.created_at);
    const bTime = Date.parse(b.paid_at ?? b.updated_at ?? b.created_at);

    return (
      (Number.isFinite(bTime) ? bTime : 0) -
      (Number.isFinite(aTime) ? aTime : 0)
    );
  });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Route returned non-JSON response. Status: ${response.status}. ${text.slice(
        0,
        140,
      )}`,
    );
  }
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-zinc-900 ${className}`} />
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

function DepositsSegmentedControl({
  selectedView,
  onChange,
  disabled = false,
}: {
  selectedView: DepositView;
  onChange: (view: DepositView) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center">
      <div className="relative z-20 inline-grid h-10 w-fit grid-cols-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">
        {DEPOSIT_TABS.map((tab, index) => {
          const active = selectedView === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tab.value)}
              className={[
                "flex h-full min-w-[66px] cursor-pointer items-center justify-center px-3.5 text-[13px] font-medium transition-colors disabled:cursor-default",
                index > 0 ? "border-l border-zinc-800" : "",
                active
                  ? "bg-zinc-800/80 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TableHeader({
  labels,
  showTimeLeft = false,
  showAction = true,
}: {
  labels: string[];
  showTimeLeft?: boolean;
  showAction?: boolean;
}) {
  return (
    <div
      className={[
        "hidden border-b border-zinc-900 bg-black/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 xl:grid",
        getDesktopDepositGridClassName(showTimeLeft, showAction),
      ].join(" ")}
    >
      {labels.map((label, index) => (
        <div key={label} className={index >= 3 ? "text-right" : "text-left"}>
          {label}
        </div>
      ))}
    </div>
  );
}

function StatusText({ status }: { status: DepositInvoiceStatus }) {
  return (
    <div
      className={["text-sm font-medium", getStatusClassName(status)].join(" ")}
    >
      {getStatusLabel(status)}
    </div>
  );
}

function InlineSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-red-400",
        className,
      ].join(" ")}
    />
  );
}

function CopyButton({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, value: string) => void;
}) {
  const isCopied = copied === label;

  return (
    <motion.button
      type="button"
      onClick={() => onCopy(label, value)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 560, damping: 34 }}
      aria-label={isCopied ? "Copied" : "Copy"}
      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center text-zinc-500 outline-none transition-colors hover:text-zinc-100 focus-visible:text-zinc-100"
    >
      {isCopied ? (
        <FiCheck className="h-4 w-4" />
      ) : (
        <FiCopy className="h-4 w-4" />
      )}
    </motion.button>
  );
}

function DetailCard({
  label,
  value,
  copyLabel,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel?: string;
  copied: string | null;
  onCopy: (label: string, value: string) => void;
}) {
  const shouldCopy = Boolean(copyLabel && value && value !== "—");

  return (
    <div className="relative rounded-2xl bg-black/30 p-4">
      {shouldCopy ? (
        <div className="absolute right-3 top-3">
          <CopyButton
            label={copyLabel!}
            value={value}
            copied={copied}
            onCopy={onCopy}
          />
        </div>
      ) : null}

      <p className="pr-9 text-[12px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1.5 break-all text-[13px] leading-5 text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function getInvoiceTransactionHash(invoice: DepositInvoice) {
  return (
    invoice.tx_hash ||
    invoice.relay_in_tx_hashes?.[0] ||
    invoice.relay_out_tx_hashes?.[0] ||
    null
  );
}

function DepositDetails({
  invoice,
  copied,
  onCopy,
  wideDesktop = false,
  rowTintClassName = "bg-zinc-950/80",
}: {
  invoice: DepositInvoice;
  copied: string | null;
  onCopy: (label: string, value: string) => void;
  wideDesktop?: boolean;
  rowTintClassName?: string;
}) {
  const transactionHash = getInvoiceTransactionHash(invoice);
  const relayStatusLabel =
    invoice.provider === "relay"
      ? formatRelayStatus(invoice.relay_status)
      : null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "overflow-hidden",
        rowTintClassName,
        wideDesktop ? "xl:min-w-[940px]" : "xl:min-w-[820px]",
      ].join(" ")}
    >
      <div className="grid gap-3 px-3 pb-4 pt-2 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
        {invoice.provider === "relay" ? (
          <DetailCard
            label="Deposit address"
            value={invoice.deposit_address || "—"}
            copyLabel={`deposit-${invoice.id}`}
            copied={copied}
            onCopy={onCopy}
          />
        ) : null}

        <DetailCard
          label="Send amount"
          value={
            invoice.provider === "promo"
              ? "Promo covered full fee"
              : `${invoice.expected_amount_display} ${invoice.asset}`
          }
          copyLabel={
            invoice.provider === "promo" ? undefined : `amount-${invoice.id}`
          }
          copied={copied}
          onCopy={onCopy}
        />

        {invoice.received_destination_amount_display ? (
          <DetailCard
            label="Received"
            value={`${invoice.received_destination_amount_display} USDC`}
            copied={copied}
            onCopy={onCopy}
          />
        ) : null}

        {transactionHash ? (
          <DetailCard
            label="Transaction"
            value={transactionHash}
            copyLabel={`tx-${invoice.id}`}
            copied={copied}
            onCopy={onCopy}
          />
        ) : null}

        {relayStatusLabel ? (
          <DetailCard
            label="Relay status"
            value={relayStatusLabel}
            copied={copied}
            onCopy={onCopy}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

function DepositTitle({ invoice }: { invoice: DepositInvoice }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-zinc-100">
        {formatCompactPlan(invoice.plan_key)}
      </div>
      <div className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
        {invoice.provider === "promo"
          ? `Promo ${invoice.promo_code ?? "code"}`
          : `#${formatDepositShortId(invoice.id)}`}
      </div>
    </div>
  );
}

function MobileDepositCard({
  invoice,
  index,
  nowMs,
  expanded,
  copied,
  canceling,
  expandable,
  onCopy,
  onToggleExpand,
  onCancel,
}: {
  invoice: DepositInvoice;
  index: number;
  nowMs: number;
  expanded: boolean;
  copied: string | null;
  canceling: boolean;
  expandable: boolean;
  onCopy: (label: string, value: string) => void;
  onToggleExpand: () => void;
  onCancel: () => void;
}) {
  const canCancel = invoice.status === "pending";
  const quantity = getDepositQuantity(invoice);
  const openTimeLabel = isOpenStatus(invoice.status)
    ? getOpenTimeLabel(invoice, nowMs)
    : null;
  const openTimeText = openTimeLabel
    ? openTimeLabel === "Processing" || openTimeLabel === "Expired"
      ? openTimeLabel
      : `${openTimeLabel} left`
    : null;
  const topRightMeta = openTimeText
    ? `${openTimeText} | Qty ${quantity}`
    : `Qty ${quantity}`;

  return (
    <div
      className={[
        "border-b border-zinc-900/80 px-3 py-4 last:border-b-0 sm:px-5 xl:hidden",
        getMobileDepositRowTintClassName(index),
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <DepositTitle invoice={invoice} />

        <div className="shrink-0 text-right">
          <div className="text-[20px] font-semibold leading-6 text-zinc-100">
            {getDepositTotal(invoice)}
          </div>
          <div className="mt-1 text-[12px] font-medium tabular-nums text-zinc-500">
            {topRightMeta}
          </div>
        </div>
      </div>

      <div
        className={[
          "mt-3 grid items-start gap-2.5 text-left",
          expandable
            ? "grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)_auto]"
            : "grid-cols-2",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="h-3.5 truncate text-[15px] font-semibold capitalize leading-[14px] tracking-[0.14em] text-zinc-600">
            Method
          </div>
          <div className="mt-2 h-6 truncate text-[15px] font-semibold leading-6 text-zinc-100">
            {invoice.asset}
          </div>
        </div>

        <div className="min-w-0 pl-1">
          <div className="h-3.5 truncate text-[15px] font-semibold capitalize  leading-[14px] tracking-[0.14em] text-zinc-600">
            Status
          </div>
          <div
            className={[
              "mt-2 h-6 truncate text-[15px] font-semibold leading-6",
              getStatusClassName(invoice.status),
            ].join(" ")}
          >
            {getStatusLabel(invoice.status)}
          </div>
        </div>

        {expandable ? (
          <div className="flex min-w-[96px] shrink-0 items-center justify-end gap-3 pt-[21px]">
            {canCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={canceling}
                className="inline-flex h-7 w-[44px] cursor-pointer items-center justify-center bg-transparent px-0 text-[15px] font-semibold leading-none text-red-400 transition-colors hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {canceling ? <InlineSpinner /> : "Cancel"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onToggleExpand}
              className="h-7 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-800 bg-black/30 px-0 text-[15px] font-semibold leading-none text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {expandable && expanded ? (
          <motion.div
            key={`mobile-details-${invoice.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 pt-3">
              {invoice.provider === "relay" ? (
                <DetailCard
                  label="Deposit address"
                  value={invoice.deposit_address || "—"}
                  copyLabel={`mobile-deposit-${invoice.id}`}
                  copied={copied}
                  onCopy={onCopy}
                />
              ) : null}

              <DetailCard
                label="Send amount"
                value={
                  invoice.provider === "promo"
                    ? "Promo covered full fee"
                    : `${invoice.expected_amount_display} ${invoice.asset}`
                }
                copyLabel={
                  invoice.provider === "promo"
                    ? undefined
                    : `mobile-amount-${invoice.id}`
                }
                copied={copied}
                onCopy={onCopy}
              />

              {invoice.received_destination_amount_display ? (
                <DetailCard
                  label="Received"
                  value={`${invoice.received_destination_amount_display} USDC`}
                  copied={copied}
                  onCopy={onCopy}
                />
              ) : null}

              {getInvoiceTransactionHash(invoice) ? (
                <DetailCard
                  label="Transaction"
                  value={getInvoiceTransactionHash(invoice) ?? "—"}
                  copyLabel={`mobile-tx-${invoice.id}`}
                  copied={copied}
                  onCopy={onCopy}
                />
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function DepositRow({
  invoice,
  index,
  nowMs,
  expanded,
  copied,
  canceling,
  onCopy,
  onToggleExpand,
  onCancel,
}: {
  invoice: DepositInvoice;
  index: number;
  nowMs: number;
  expanded: boolean;
  copied: string | null;
  canceling: boolean;
  onCopy: (label: string, value: string) => void;
  onToggleExpand: () => void;
  onCancel: () => void;
}) {
  const canCancel = invoice.status === "pending";
  const quantity = getDepositQuantity(invoice);
  const showTimeLeft = isOpenStatus(invoice.status);
  const expandable = showTimeLeft;

  return (
    <>
      <MobileDepositCard
        invoice={invoice}
        index={index}
        nowMs={nowMs}
        expanded={expandable && expanded}
        copied={copied}
        canceling={canceling}
        expandable={expandable}
        onCopy={onCopy}
        onToggleExpand={onToggleExpand}
        onCancel={onCancel}
      />

      <div className="hidden border-b border-zinc-900/80 xl:block">
        <div
          className={[
            "grid items-center px-5 py-3.5 text-sm transition-colors hover:bg-zinc-900/55",
            getDesktopDepositGridClassName(showTimeLeft, expandable),
            getDepositRowTintClassName(index),
          ].join(" ")}
        >
          <DepositTitle invoice={invoice} />

          <div className="font-medium text-zinc-300">{invoice.asset}</div>

          <StatusText status={invoice.status} />

          <div className="text-right font-semibold text-zinc-100">
            {quantity}
          </div>

          <div className="text-right font-semibold text-zinc-100">
            {getDepositTotal(invoice)}
          </div>

          {showTimeLeft ? (
            <div className="text-right font-semibold tabular-nums text-zinc-100">
              {getOpenTimeLabel(invoice, nowMs)}
            </div>
          ) : null}

          {expandable ? (
            <div className="flex items-center justify-end gap-3 pl-6">
              {canCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={canceling}
                  className="inline-flex h-9 w-[50px] cursor-pointer items-center justify-center bg-transparent px-0 text-[12px] font-semibold text-red-400 transition-colors hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {canceling ? <InlineSpinner /> : "Cancel"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={onToggleExpand}
                className="h-9 w-[54px] cursor-pointer rounded-xl border border-zinc-800 bg-black/30 px-0 text-[12px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
              >
                {expanded ? "Hide" : "View"}
              </button>
            </div>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {expandable && expanded ? (
            <DepositDetails
              key={`details-${invoice.id}`}
              invoice={invoice}
              copied={copied}
              onCopy={onCopy}
              wideDesktop={showTimeLeft}
              rowTintClassName={getDepositRowTintClassName(index)}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

function EmptyOpenDepositsRow() {
  return (
    <div className="border-b border-zinc-900/80 px-3 py-3 last:border-b-0 sm:px-5 xl:min-w-[940px]">
      <EmptyState
        title="No open deposits"
        description="Crypto deposits you have started but not completed will appear here."
        action={
          <Link
            href="/accounts"
            className="relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] px-4 text-[13px] font-bold leading-none text-[#120d02] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-colors duration-150 hover:from-[#cfa13a] hover:via-[#bd9130] hover:to-[#9f7626] whitespace-nowrap"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-white/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]"
            />
            <span className="relative z-10">Start Challenge</span>
          </Link>
        }
      />
    </div>
  );
}

function EmptyTableRow({ message }: { message: string }) {
  return (
    <div className="border-b border-zinc-900/80 px-4 py-8 text-sm text-zinc-500 last:border-b-0 sm:px-5 xl:min-w-[700px]">
      {message}
    </div>
  );
}

function DepositsSkeleton() {
  return (
    <div>
      <DepositsSegmentedControl
        selectedView="open"
        onChange={() => {}}
        disabled
      />

      <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80 xl:overflow-x-auto">
        <TableHeader
          labels={[
            "Deposit",
            "Method",
            "Status",
            "Qty",
            "Total",
            "Time left",
            "Action",
          ]}
          showTimeLeft
        />

        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`deposit-skeleton-${index}`}
            className={[
              "border-b border-zinc-900/80 px-3 py-4 last:border-b-0 sm:px-5 xl:min-w-[940px] xl:py-3.5",
              getMobileDepositRowTintClassName(index),
              "xl:bg-transparent",
            ].join(" ")}
          >
            <div className="xl:hidden">
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="mt-2 h-3 w-20" />
                </div>

                <div className="shrink-0 text-right">
                  <SkeletonBlock className="ml-auto h-6 w-20" />
                  <SkeletonBlock className="ml-auto mt-2 h-3 w-16" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)_auto] items-start gap-2.5">
                <div className="min-w-0">
                  <SkeletonBlock className="h-3.5 w-16" />
                  <SkeletonBlock className="mt-2 h-6 w-12" />
                </div>

                <div className="min-w-0 pl-1">
                  <SkeletonBlock className="h-3.5 w-16" />
                  <SkeletonBlock className="mt-2 h-6 w-20" />
                </div>

                <div className="flex min-w-[96px] shrink-0 items-center justify-end gap-3 pt-[21px]">
                  <SkeletonBlock className="h-7 w-[44px]" />
                  <SkeletonBlock className="h-7 w-12 rounded-lg" />
                </div>
              </div>
            </div>

            <div
              className={[
                "hidden items-center xl:grid",
                getDesktopDepositGridClassName(true),
              ].join(" ")}
            >
              <div>
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="mt-2 h-3 w-20" />
              </div>
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="ml-auto h-4 w-8" />
              <SkeletonBlock className="ml-auto h-4 w-16" />
              <SkeletonBlock className="ml-auto h-4 w-14" />
              <SkeletonBlock className="ml-auto h-9 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositsTable({
  openDeposits,
  pastDeposits,
  selectedView,
  nowMs,
  expandedDepositId,
  copied,
  cancelingId,
  onSelectedViewChange,
  onToggleExpand,
  onCopy,
  onCancel,
}: {
  openDeposits: DepositInvoice[];
  pastDeposits: DepositInvoice[];
  selectedView: DepositView;
  nowMs: number;
  expandedDepositId: string | null;
  copied: string | null;
  cancelingId: string | null;
  onSelectedViewChange: (view: DepositView) => void;
  onToggleExpand: (invoiceId: string) => void;
  onCopy: (label: string, value: string) => void;
  onCancel: (invoice: DepositInvoice) => void;
}) {
  const showingOpen = selectedView === "open";
  const deposits = showingOpen ? openDeposits : pastDeposits;

  return (
    <div>
      <DepositsSegmentedControl
        selectedView={selectedView}
        onChange={onSelectedViewChange}
      />

      <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80 shadow-sm xl:overflow-x-auto">
        <TableHeader
          labels={
            showingOpen
              ? [
                  "Deposit",
                  "Method",
                  "Status",
                  "Qty",
                  "Total",
                  "Time left",
                  "Action",
                ]
              : ["Deposit", "Method", "Status", "Qty", "Total"]
          }
          showTimeLeft={showingOpen}
          showAction={showingOpen}
        />

        {deposits.length ? (
          deposits.map((invoice, index) => (
            <DepositRow
              key={invoice.id}
              invoice={invoice}
              index={index}
              nowMs={nowMs}
              expanded={showingOpen && expandedDepositId === invoice.id}
              copied={copied}
              canceling={cancelingId === invoice.id}
              onCopy={onCopy}
              onToggleExpand={() => onToggleExpand(invoice.id)}
              onCancel={() => onCancel(invoice)}
            />
          ))
        ) : showingOpen ? (
          <EmptyOpenDepositsRow />
        ) : (
          <EmptyTableRow message="No past deposits." />
        )}
      </div>
    </div>
  );
}

export default function DepositsPage() {
  const { ready, authenticated, login, user } = usePrivy();

  const [deposits, setDeposits] = useState<DepositInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<DepositView>("open");
  const [expandedDepositId, setExpandedDepositId] = useState<string | null>(
    null,
  );
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const privyUserId = user?.id ?? null;

  const openDeposits = useMemo(
    () =>
      sortDepositsByActivity(
        deposits.filter((invoice) => isOpenStatus(invoice.status)),
      ),
    [deposits],
  );

  const pastDeposits = useMemo(
    () =>
      sortDepositsByActivity(
        deposits.filter((invoice) => !isOpenStatus(invoice.status)),
      ),
    [deposits],
  );

  function handleSelectedViewChange(view: DepositView) {
    setSelectedView(view);
    setExpandedDepositId(null);
  }

  async function loadDeposits(options?: { silent?: boolean }) {
    if (!ready) return;

    if (!authenticated || !privyUserId) {
      setDeposits([]);
      setLoading(false);
      return;
    }

    try {
      if (!options?.silent) {
        setLoading(true);
      }

      setError(null);

      const response = await fetch(
        `/api/crypto-deposits/mine?privyUserId=${encodeURIComponent(privyUserId)}&t=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        },
      );

      const data = (await readJsonResponse(
        response,
      )) as DepositsResponse | null;

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Unable to load deposits.",
        );
      }

      setDeposits(data?.deposits ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to load deposits.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function cancelDeposit(invoice: DepositInvoice) {
    if (!privyUserId || cancelingId) return;

    if (invoice.status !== "pending") {
      toast.error("Deposit not canceled", {
        description: "Only pending deposits can be canceled.",
      });
      return;
    }

    try {
      setCancelingId(invoice.id);

      const response = await fetch(
        `/api/crypto-deposits/${invoice.id}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ privyUserId }),
        },
      );

      const data = (await readJsonResponse(
        response,
      )) as CancelDepositResponse | null;

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Unable to cancel deposit.",
        );
      }

      toast("Deposit canceled", {
        description: "This quote is no longer active.",
      });

      setExpandedDepositId(null);
      await loadDeposits({ silent: true });
    } catch (err) {
      console.error(err);
      toast.error("Deposit not canceled", {
        description:
          err instanceof Error ? err.message : "Unable to cancel deposit.",
      });
    } finally {
      setCancelingId(null);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);

      window.setTimeout(() => {
        setCopied(null);
      }, 1200);
    } catch {
      toast.error("Unable to copy", {
        description: "Please copy it manually.",
      });
    }
  }

  function toggleExpanded(invoiceId: string) {
    setExpandedDepositId((current) =>
      current === invoiceId ? null : invoiceId,
    );
  }

  useEffect(() => {
    loadDeposits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, privyUserId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || !privyUserId || openDeposits.length === 0)
      return;

    const interval = window.setInterval(() => {
      loadDeposits({ silent: true });
    }, 15000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, privyUserId, openDeposits.length]);

  return (
    <div className="min-h-screen bg-[#09090b] pb-24 text-white md:pb-0">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-20 sm:px-6 md:py-15 md:pb-24">
        <div className="mb-2 sm:mb-3">
          <div className="flex h-[36px] max-w-full items-start overflow-hidden sm:h-[42px] lg:h-[44px]">
            <h1 className="truncate text-[29px] font-semibold leading-[1.08] tracking-tight text-zinc-100 sm:text-[34px] lg:text-[36px]">
              Deposits
            </h1>
          </div>
        </div>

        {!ready || loading ? (
          <DepositsSkeleton />
        ) : !authenticated ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80 shadow-sm">
            <div className="border-b border-zinc-900/80 px-3 py-3 last:border-b-0 sm:px-5 xl:min-w-[940px]">
              <EmptyState
                title="Sign in to view"
                description="Open and past crypto deposits will appear here. Sign in to monitor."
                action={
                  <button
                    type="button"
                    onClick={login}
                    className="relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] px-4 text-[13px] font-bold leading-none text-[#120d02] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-colors duration-150 hover:from-[#cfa13a] hover:via-[#bd9130] hover:to-[#9f7626]"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-white/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]"
                    />
                    <span className="relative z-10">Sign in</span>
                  </button>
                }
              />
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-5 rounded-2xl border border-red-950 bg-red-950/20 p-4 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <DepositsTable
              openDeposits={openDeposits}
              pastDeposits={pastDeposits}
              selectedView={selectedView}
              nowMs={nowMs}
              expandedDepositId={expandedDepositId}
              copied={copied}
              cancelingId={cancelingId}
              onSelectedViewChange={handleSelectedViewChange}
              onToggleExpand={toggleExpanded}
              onCopy={copyText}
              onCancel={cancelDeposit}
            />
          </>
        )}
      </div>
    </div>
  );
}