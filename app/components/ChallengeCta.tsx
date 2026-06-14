"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { FiCheck, FiCopy } from "react-icons/fi";
import type { PlanKey } from "@/lib/plans";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

type ButtonStyle = "gold" | "silver" | "default";
type DepositStep = "method" | "payment";
type DepositChain = "solana" | "ethereum" | "bitcoin";

type PromoPreview = {
  valid: boolean;
  code: string | null;
  promoCodeId: string | null;
  subtotalCents: number;
  discountCents: number;
  finalCents: number;
  message: string | null;
};

type DepositInvoice = {
  id: string;
  provider: "relay" | "promo";
  chain: DepositChain;
  asset: "SOL" | "ETH" | "BTC";
  deposit_address: string;
  relay_deposit_address?: string | null;
  relay_request_id?: string | null;
  relay_status?: string | null;
  expected_amount_display: string;
  expected_destination_amount_display?: string | null;
  destination_address?: string | null;
  status:
    | "pending"
    | "processing"
    | "paid"
    | "expired"
    | "refunded"
    | "failed"
    | "invalid";
  expires_at: string;
  tx_hash?: string | null;
  confirmations?: number | null;
  credited_account_id?: string | null;
  relay_in_tx_hashes?: string[] | null;
  relay_out_tx_hashes?: string[] | null;
  promo_code?: string | null;
  subtotal_amount_cents?: number | null;
  discount_amount_cents?: number | null;
  final_amount_cents?: number | null;
};

type ChallengeCtaProps = {
  cta: string;
  buttonStyle: ButtonStyle;
  shimmerEnabled: boolean;
  planKey: PlanKey;
};

const PAYMENT_METHODS: {
  chain: DepositChain;
  asset: "SOL" | "ETH" | "BTC";
  title: string;
  subtitle: string;
  network: string;
  iconSrc: string;
}[] = [
  {
    chain: "solana",
    asset: "SOL",
    title: "Solana",
    subtitle: "Pay with SOL",
    network: "Solana",
    iconSrc: "/sol.png",
  },
  {
    chain: "ethereum",
    asset: "ETH",
    title: "Ethereum",
    subtitle: "Pay with ETH",
    network: "Ethereum mainnet",
    iconSrc: "/eth.png",
  },
  {
    chain: "bitcoin",
    asset: "BTC",
    title: "Bitcoin",
    subtitle: "Pay with BTC",
    network: "Bitcoin Network",
    iconSrc: "/btc.png",
  },
];

const ELLIPSIS_STEPS = [".", "..", "...", ""];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");

    function updateIsMobile() {
      setIsMobile(query.matches);
    }

    updateIsMobile();
    query.addEventListener("change", updateIsMobile);

    return () => {
      query.removeEventListener("change", updateIsMobile);
    };
  }, []);

  return isMobile;
}

function getButtonShellClassName(style: ButtonStyle) {
  if (style === "gold") return "bg-[#7b5a12]";
  if (style === "silver") return "bg-zinc-500";
  return "bg-zinc-800";
}

function getButtonFaceClassName(style: ButtonStyle) {
  if (style === "gold") {
    return "border border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] text-[#120d02]";
  }

  if (style === "silver") {
    return "border border-zinc-400 bg-linear-to-br from-zinc-100 via-zinc-300 to-zinc-400 text-zinc-900";
  }

  return "border border-zinc-800 bg-zinc-900 text-zinc-100";
}

function getShimmerClassName(style: ButtonStyle) {
  if (style === "gold") {
    return "pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-[#fff6d5]/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]";
  }

  return "pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-white/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]";
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

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function normalizePromoInput(value: string) {
  return value.toUpperCase().replace(/\s+/g, "");
}

function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function getAccountTitle(planKey: PlanKey) {
  const accountSize = Number(planKey);

  if (!Number.isFinite(accountSize) || accountSize <= 0) {
    return "Account";
  }

  return `${accountSize / 1000}K Account`;
}

function getStepIndex(step: DepositStep) {
  if (step === "method") return 0;
  return 1;
}

function getStatusLabel(status: DepositInvoice["status"]) {
  if (status === "processing") return "processing";
  if (status === "refunded") return "refunded";
  return status;
}

function isTerminalStatus(status: DepositInvoice["status"]) {
  return ["paid", "expired", "failed", "refunded", "invalid"].includes(status);
}

function StepDots({ step }: { step: DepositStep }) {
  const activeIndex = getStepIndex(step);

  return (
    <div className="flex items-center gap-1.5">
      {[0, 1].map((index) => (
        <div
          key={index}
          className={[
            "h-1.5 rounded-full transition-all",
            index === activeIndex ? "w-5 bg-zinc-100" : "w-1.5 bg-zinc-700",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: DepositInvoice["status"] }) {
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[12px] font-semibold capitalize text-zinc-300">
      {getStatusLabel(status)}
    </div>
  );
}

function LoadingEllipsis() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % ELLIPSIS_STEPS.length);
    }, 420);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="inline-block w-[1.15em] text-left align-baseline text-zinc-600"
    >
      {ELLIPSIS_STEPS[index]}
    </span>
  );
}

function CopyIconButton({
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
      <AnimatePresence mode="wait" initial={false}>
        {isCopied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.5, y: 3, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -3, rotate: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="grid place-items-center text-zinc-100"
          >
            <FiCheck className="h-4 w-4" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.5, y: 3, rotate: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -3, rotate: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="grid place-items-center"
          >
            <FiCopy className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function InfoCard({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-black/30 p-4">
      {action ? <div className="absolute right-3 top-3">{action}</div> : null}

      <p className="pr-9 text-[12px] font-medium text-zinc-500">{label}</p>

      <p className="mt-1.5 break-all text-[13px] leading-5 text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function OffsetButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={["rounded-2xl bg-zinc-800", className].join(" ")}
      style={{ paddingBottom: "2px" }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="h-12 w-full translate-y-[-2px] cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 text-[15px] font-semibold text-zinc-100 transition-[transform,opacity] duration-100 hover:translate-y-[-1px] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </button>
    </div>
  );
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

function PaymentBadge({
  asset,
  iconSrc,
}: {
  asset: "SOL" | "ETH" | "BTC";
  iconSrc: string;
}) {
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
      <Image
        src={iconSrc}
        alt={`${asset} logo`}
        fill
        sizes="36px"
        className="object-contain"
      />
    </div>
  );
}

function CheckoutContent({
  accountTitle,
  step,
  setStep,
  invoice,
  error,
  copied,
  countdown,
  creatingChain,
  createInvoice,
  copyText,
  openAccount,
  promoCode,
  promoMessage,
  appliedPromo,
  isApplyingPromo,
  onPromoCodeChange,
  applyPromoCode,
}: {
  accountTitle: string;
  step: DepositStep;
  setStep: (step: DepositStep) => void;
  invoice: DepositInvoice | null;
  error: string | null;
  copied: string | null;
  countdown: string;
  creatingChain: DepositChain | null;
  createInvoice: (chain: DepositChain) => void;
  copyText: (label: string, value: string) => void;
  openAccount: (accountId: string) => void;
  promoCode: string;
  promoMessage: string | null;
  appliedPromo: PromoPreview | null;
  isApplyingPromo: boolean;
  onPromoCodeChange: (value: string) => void;
  applyPromoCode: () => void;
}) {
  const cleanPromoCode = normalizePromoInput(promoCode);
  const isPromoApplied =
    Boolean(appliedPromo?.code) && appliedPromo?.code === cleanPromoCode;
  const isFreePromoApplied = isPromoApplied && appliedPromo?.finalCents === 0;
  const isPromoInvoice = invoice?.provider === "promo";
  const shouldShowPromoMessage = Boolean(promoMessage) && !isPromoApplied;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            {accountTitle}
          </p>

          <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">
            Start challenge
          </h2>
        </div>

        <div className="shrink-0 pt-1.5">
          <StepDots step={step} />
        </div>
      </div>

      <div className="mt-5 min-h-[350px]">
        <AnimatePresence mode="wait">
          {step === "method" ? (
            <motion.div
              key="method"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex min-h-[350px] flex-col"
            >
              <div>
                <h3 className="text-[18px] font-semibold tracking-tight text-zinc-50">
                  Choose payment method
                </h3>
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/30 p-3">
                <div className="flex h-10 items-center gap-2">
                  <input
                    value={promoCode}
                    onChange={(event) =>
                      onPromoCodeChange(event.target.value)
                    }
                    placeholder="Promo code"
                    autoCapitalize="characters"
                    className="min-w-0 flex-1 bg-transparent px-1 text-[14px] font-semibold uppercase tracking-[0.08em] text-zinc-100 outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600"
                  />

                  <button
                    type="button"
                    onClick={applyPromoCode}
                    disabled={isApplyingPromo || !cleanPromoCode}
                    className="h-9 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-[12px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isApplyingPromo
                      ? "..."
                      : isPromoApplied
                        ? "Applied"
                        : "Apply"}
                  </button>
                </div>

                {shouldShowPromoMessage ? (
                  <p className="mt-2 text-[12px] leading-5 text-red-300">
                    {promoMessage}
                  </p>
                ) : null}

                {isPromoApplied && appliedPromo ? (
                  <div className="mt-3 border-t border-zinc-900 pt-3">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-zinc-500">Discount</span>
                      <span className="font-semibold text-zinc-100">
                        -{formatCents(appliedPromo.discountCents)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[12px]">
                      <span className="text-zinc-500">New total</span>
                      <span className="font-semibold text-zinc-100">
                        {formatCents(appliedPromo.finalCents)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {isFreePromoApplied ? (
                <OffsetButton
                  onClick={() => createInvoice("solana")}
                  disabled={Boolean(creatingChain)}
                  className="mt-3"
                >
                  {creatingChain ? "Creating account..." : "Create free account"}
                </OffsetButton>
              ) : (
                <div className="mt-3 grid gap-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const loading = creatingChain === method.chain;
                    const disabled = Boolean(creatingChain);

                    return (
                      <button
                        key={method.chain}
                        type="button"
                        onClick={() => createInvoice(method.chain)}
                        disabled={disabled}
                        className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-black/30 px-4 py-3.5 text-left transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <PaymentBadge
                            asset={method.asset}
                            iconSrc={method.iconSrc}
                          />

                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold text-zinc-100">
                              {method.title}
                            </div>

                            <div className="mt-0.5 text-[12px] text-zinc-500">
                              {loading
                                ? "Creating deposit..."
                                : `${method.subtitle} on ${method.network}`}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[12px] font-bold text-zinc-300">
                          {method.asset}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {error ? (
                <div className="mt-3 rounded-2xl border border-red-950 bg-red-950/30 px-4 py-3 text-[13px] leading-5 text-red-300">
                  {error}
                </div>
              ) : null}

              <div className="mt-auto pt-5">
                <p className="text-center text-[12px] leading-5 text-zinc-600">
                  {isFreePromoApplied
                    ? "Testing promo creates an account instantly without crypto."
                    : "Do not send Lightning BTC. Use standard Bitcoin Network for BTC deposits."}
                </p>
              </div>
            </motion.div>
          ) : null}

          {step === "payment" && invoice ? (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex min-h-[350px] flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[18px] font-semibold tracking-tight text-zinc-50">
                    {isPromoInvoice
                      ? "Account ready"
                      : `Send ${invoice.asset} deposit`}
                  </h3>

                  <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                    {isPromoInvoice
                      ? "Your promo code covered the full evaluation fee."
                      : "Send the exact amount below to the Relay deposit address."}
                  </p>
                </div>

                <StatusPill status={invoice.status} />
              </div>

              {isPromoInvoice ? (
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-zinc-500">
                        Promo {invoice.promo_code}
                      </span>

                      <span className="font-semibold text-zinc-100">
                        -{formatCents(invoice.discount_amount_cents ?? 0)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-zinc-900 pt-3 text-[12px]">
                      <span className="text-zinc-500">Total paid</span>
                      <span className="font-semibold text-zinc-100">$0.00</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  <div className="relative rounded-2xl border border-zinc-800 bg-black/30 p-4">
                    <div className="absolute right-3 top-3">
                      <CopyIconButton
                        label="amount"
                        value={invoice.expected_amount_display}
                        copied={copied}
                        onCopy={copyText}
                      />
                    </div>

                    <p className="pr-9 text-[12px] font-medium text-zinc-500">
                      Send exactly
                    </p>

                    <div className="mt-1.5 flex items-end justify-between gap-3">
                      <p className="break-all text-[28px] font-semibold leading-none tracking-tight text-zinc-50">
                        {invoice.expected_amount_display}
                      </p>

                      <p className="pb-0.5 text-[13px] font-bold text-zinc-400">
                        {invoice.asset}
                      </p>
                    </div>
                  </div>

                  <InfoCard
                    label="Deposit address"
                    value={invoice.deposit_address}
                    action={
                      <CopyIconButton
                        label="deposit"
                        value={invoice.deposit_address}
                        copied={copied}
                        onCopy={copyText}
                      />
                    }
                  />

                  {invoice.discount_amount_cents &&
                  invoice.discount_amount_cents > 0 ? (
                    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-zinc-500">
                          Promo {invoice.promo_code}
                        </span>

                        <span className="font-semibold text-zinc-100">
                          -{formatCents(invoice.discount_amount_cents)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                      <p className="text-[12px] font-medium text-zinc-500">
                        Time left
                      </p>

                      <p className="mt-1 text-[18px] font-semibold text-zinc-100">
                        {invoice.status === "paid"
                          ? "Complete"
                          : invoice.status === "expired"
                            ? "Expired"
                            : isTerminalStatus(invoice.status)
                              ? getStatusLabel(invoice.status)
                              : countdown}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                      <p className="text-[12px] font-medium text-zinc-500">
                        Relay status
                      </p>

                      <p className="mt-1 truncate text-[18px] font-semibold capitalize text-zinc-100">
                        {invoice.status === "paid"
                          ? "Success"
                          : invoice.relay_status || invoice.status}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {invoice.status === "paid" && invoice.credited_account_id ? (
                <div className="mt-auto pt-5">
                  <OffsetButton
                    onClick={() => openAccount(invoice.credited_account_id!)}
                  >
                    Open account
                  </OffsetButton>
                </div>
              ) : (
                <div className="mt-auto pt-5">
                  <p className="text-center text-[12px] leading-5 text-zinc-600">
                    Waiting for {invoice.asset} to{" "}
                    {shortenAddress(invoice.deposit_address)}
                    <LoadingEllipsis />
                  </p>
                </div>
              )}

              {invoice.status !== "paid" ? (
                <button
                  type="button"
                  onClick={() => setStep("method")}
                  className="mt-3 w-full cursor-pointer text-center text-[12px] font-medium text-zinc-500 hover:text-zinc-300"
                >
                  Start a different deposit
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function ChallengeCta({
  cta,
  buttonStyle,
  shimmerEnabled,
  planKey,
}: ChallengeCtaProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DepositStep>("method");
  const [invoice, setInvoice] = useState<DepositInvoice | null>(null);
  const [creatingChain, setCreatingChain] = useState<DepositChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoPreview | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  const accountTitle = getAccountTitle(planKey);

  const privyUserId = user?.id ?? null;
  const email = user?.email?.address ?? null;
  const walletAddress =
    user?.wallet?.address ??
    user?.linkedAccounts?.find((account) => account.type === "wallet")
      ?.address ??
    null;

  const expiresAtMs = invoice?.expires_at
    ? new Date(invoice.expires_at).getTime()
    : null;

  const countdown = formatCountdown(expiresAtMs ? expiresAtMs - nowMs : 0);

  const ctaClassName = [
    "relative inline-flex h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-[16px] px-4 text-[15px] font-semibold transition-transform duration-100 hover:translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70",
    getButtonFaceClassName(buttonStyle),
  ].join(" ");

  const ctaStyle = {
    transform: "translateY(-2px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
  } as const;

  function resetFlow() {
    setStep("method");
    setInvoice(null);
    setError(null);
    setCopied(null);
    setCreatingChain(null);
    setPromoCode("");
    setPromoMessage(null);
    setAppliedPromo(null);
    setIsApplyingPromo(false);
  }

  function openCheckout() {
    if (!ready) return;

    if (!authenticated) {
      login();
      return;
    }

    resetFlow();
    setOpen(true);
  }

  function closeCheckout() {
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    closeCheckout();
  }

  function openAccount(accountId: string) {
    router.push(`/accounts/${accountId}`);
  }

  function handlePromoCodeChange(value: string) {
    const nextValue = normalizePromoInput(value);

    setPromoCode(nextValue);
    setAppliedPromo(null);
    setPromoMessage(null);
  }

  async function applyPromoCode() {
    if (!privyUserId || isApplyingPromo) return;

    const cleanPromoCode = normalizePromoInput(promoCode);

    if (!cleanPromoCode) {
      setAppliedPromo(null);
      setPromoMessage(null);
      return;
    }

    try {
      setIsApplyingPromo(true);
      setError(null);
      setPromoMessage(null);

      const response = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planKey,
          promoCode: cleanPromoCode,
          privyUserId,
        }),
      });

      const data = (await readJsonResponse(response)) as PromoPreview;

      if (!response.ok) {
        throw new Error(data?.message || "Invalid promo code.");
      }

      setAppliedPromo(data);
      setPromoCode(data.code ?? cleanPromoCode);
      setPromoMessage(null);
    } catch (error) {
      setAppliedPromo(null);
      setPromoMessage(
        error instanceof Error ? error.message : "Invalid promo code.",
      );
    } finally {
      setIsApplyingPromo(false);
    }
  }

  async function createInvoice(chain: DepositChain) {
    if (!privyUserId || creatingChain) return;

    try {
      setCreatingChain(chain);
      setError(null);

      const cleanPromoCode = appliedPromo?.code ?? normalizePromoInput(promoCode);

      const response = await fetch("/api/crypto-deposits/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planKey,
          chain,
          promoCode: cleanPromoCode || null,
          privyUserId,
          email,
          walletAddress,
        }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create deposit invoice.");
      }

      if (!data?.invoice) {
        throw new Error("Deposit invoice was not returned.");
      }

      setInvoice(data.invoice);
      setStep("payment");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create deposit.",
      );
    } finally {
      setCreatingChain(null);
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
      setError("Unable to copy. Please copy it manually.");
    }
  }

  useEffect(() => {
    if (!open) return;

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open || !invoice?.id || !privyUserId) return;
    if (isTerminalStatus(invoice.status)) return;

    let cancelled = false;

    const pollInvoice = async () => {
      try {
        const response = await fetch(
          `/api/crypto-deposits/${invoice.id}?privyUserId=${encodeURIComponent(
            privyUserId,
          )}&t=${Date.now()}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          },
        );

        const data = await readJsonResponse(response);

        if (!response.ok) {
          console.log("[deposit-modal] poll failed", data);
          return;
        }

        if (!data?.invoice || cancelled) return;

        console.log("[deposit-modal] invoice update", {
          id: data.invoice.id,
          status: data.invoice.status,
          relayStatus: data.invoice.relay_status,
          creditedAccountId: data.invoice.credited_account_id,
        });

        setInvoice(data.invoice);

        if (
          data.invoice.status === "paid" &&
          data.invoice.credited_account_id
        ) {
          router.refresh();
        }
      } catch (error) {
        console.log("[deposit-modal] poll error", error);
      }
    };

    pollInvoice();

    const interval = window.setInterval(pollInvoice, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, invoice?.id, invoice?.status, privyUserId, router]);

  const checkoutContent = (
    <CheckoutContent
      accountTitle={accountTitle}
      step={step}
      setStep={setStep}
      invoice={invoice}
      error={error}
      copied={copied}
      countdown={countdown}
      creatingChain={creatingChain}
      createInvoice={createInvoice}
      copyText={copyText}
      openAccount={openAccount}
      promoCode={promoCode}
      promoMessage={promoMessage}
      appliedPromo={appliedPromo}
      isApplyingPromo={isApplyingPromo}
      onPromoCodeChange={handlePromoCodeChange}
      applyPromoCode={applyPromoCode}
    />
  );

  return (
    <>
      <div
        className={[
          "mt-4 inline-block w-full rounded-[16px]",
          getButtonShellClassName(buttonStyle),
        ].join(" ")}
        style={{ paddingBottom: "2px", lineHeight: 0 }}
      >
        <button
          type="button"
          onClick={openCheckout}
          disabled={!ready}
          className={ctaClassName}
          style={ctaStyle}
        >
          {shimmerEnabled ? (
            <span
              aria-hidden="true"
              className={getShimmerClassName(buttonStyle)}
            />
          ) : null}

          <span className="relative z-10">{cta}</span>
        </button>
      </div>

      {isMobile ? (
        <Drawer
          open={open}
          onOpenChange={handleOpenChange}
          repositionInputs={false}
        >
          <DrawerContent className="overflow-hidden border-zinc-800 bg-zinc-950 text-white outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 data-[state=open]:outline-none data-[vaul-drawer-direction=bottom]:max-h-none">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Start challenge</DrawerTitle>
              <DrawerDescription>
                Choose a payment method and send a crypto deposit to start a
                challenge account.
              </DrawerDescription>
            </DrawerHeader>

            <div className="mx-auto w-full max-w-[520px] overflow-hidden bg-zinc-950 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
              <div className="mx-auto mb-5 h-1.5 w-12 shrink-0 rounded-full bg-zinc-800" />

              <div className="max-h-[calc(100dvh-56px)] overflow-y-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {checkoutContent}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden bg-black/75 px-4 pb-4 sm:items-center sm:pb-0">
          <button
            type="button"
            aria-label="Close checkout"
            className="absolute inset-0 cursor-pointer"
            onClick={closeCheckout}
          />

          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
            {checkoutContent}
          </div>
        </div>
      ) : null}
    </>
  );
}