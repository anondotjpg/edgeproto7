"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
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
  provider: "relay" | "promo";
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

  expected_destination_amount_atomic?: string | null;
  quoted_destination_amount_atomic?: string | null;
  edge_min_destination_amount_atomic?: string | null;
  received_destination_amount_atomic?: string | null;

  destination_address?: string | null;
  status: DepositInvoiceStatus;
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
  account_quantity?: number | null;
};

type CreateDepositResponse = {
  invoice?: DepositInvoice;
  promo?: {
    code: string | null;
    subtotalCents: number;
    discountCents: number;
    finalCents: number;
  };
  code?: string;
  error?: string;
  message?: string;
  toastTitle?: string;
  toastDescription?: string;
  openDepositCount?: number;
  maxOpenDeposits?: number;
};

type PromoValidateSuccessResponse = PromoPreview & {
  error?: string;
  toastTitle?: string;
  toastDescription?: string;
};

type PromoValidateErrorResponse = {
  valid?: false;
  code?: string;
  error?: string;
  message?: string | null;
  toastTitle?: string;
  toastDescription?: string;
};

type PromoValidateResponse =
  | PromoValidateSuccessResponse
  | PromoValidateErrorResponse;

function isPromoValidateSuccess(
  value: PromoValidateResponse | null,
): value is PromoValidateSuccessResponse {
  if (!value || value.valid !== true) {
    return false;
  }

  return (
    (typeof value.code === "string" || value.code === null) &&
    (typeof value.promoCodeId === "string" || value.promoCodeId === null) &&
    typeof value.subtotalCents === "number" &&
    typeof value.discountCents === "number" &&
    typeof value.finalCents === "number" &&
    (typeof value.message === "string" || value.message === null)
  );
}

type ChallengeCtaProps = {
  cta: string;
  buttonStyle: ButtonStyle;
  shimmerEnabled: boolean;
  planKey: PlanKey;
  accountQuantity?: number;
  onAccountQuantityChange?: (quantity: number) => void;
  inlineLayout?: boolean;
};

const PLAN_FEE_CENTS: Partial<Record<PlanKey, number>> = {
  "10000": 29900,
  "5000": 17900,
  "2000": 8900,
  "1000": 4900,
};

const PLAN_IMAGE_SRC: Record<PlanKey, string> = {
  "10000": "/10k.png",
  "5000": "/5k.png",
  "2000": "/2k.png",
  "1000": "/1k.png",
};

const MAX_ACCOUNT_QUANTITY = 5;

const CHECKOUT_LAYOUT_TRANSITION = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.75,
} as const;

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
  const dollars = cents / 100;
  const hasDecimalCents = cents % 100 !== 0;

  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasDecimalCents ? 2 : 0,
    maximumFractionDigits: hasDecimalCents ? 2 : 0,
  });
}

function clampAccountQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;

  return Math.min(MAX_ACCOUNT_QUANTITY, Math.max(1, Math.round(value)));
}

function getAccountQuantityLabel(quantity: number) {
  return quantity === 1 ? "1 account" : `${quantity} accounts`;
}

function getInvoiceAccountQuantity(
  invoice: DepositInvoice | null | undefined,
  fallbackQuantity = 1,
) {
  return clampAccountQuantity(
    Number(invoice?.account_quantity ?? fallbackQuantity),
  );
}

function normalizePromoInput(value: string) {
  return value.toUpperCase().replace(/\s+/g, "");
}

function AccountHero({
  feeLabel,
  planKey,
}: {
  feeLabel: string;
  planKey: PlanKey;
}) {
  return (
    <div className="flex min-h-[48px] items-start justify-between gap-5">
      <div className="flex min-w-0 flex-1 items-start">
        <Image
          src={PLAN_IMAGE_SRC[planKey]}
          alt={`${Number(planKey) / 1000}K challenge`}
          width={128}
          height={52}
          sizes="128px"
          className="h-11 w-auto max-w-[132px] object-contain object-left"
          priority
        />
      </div>

      <p className="shrink-0 self-start text-right text-[24px] font-semibold leading-none tracking-[-0.03em] text-zinc-50 tabular-nums">
        {feeLabel}
      </p>
    </div>
  );
}

function getPlanFeeLabel(planKey: PlanKey) {
  const planFeeCents = PLAN_FEE_CENTS[planKey];

  if (typeof planFeeCents === "number") {
    return formatCents(planFeeCents);
  }

  return "Evaluation fee";
}

function getDiscountedFeeLabel({
  feeLabel,
  appliedPromo,
  invoice,
  accountQuantity,
  planKey,
}: {
  feeLabel: string;
  appliedPromo: PromoPreview | null;
  invoice?: DepositInvoice | null;
  accountQuantity: number;
  planKey: PlanKey;
}) {
  const safeQuantity = clampAccountQuantity(accountQuantity);

  if (typeof invoice?.final_amount_cents === "number") {
    return formatCents(invoice.final_amount_cents);
  }

  if (typeof appliedPromo?.finalCents === "number") {
    return formatCents(appliedPromo.finalCents * safeQuantity);
  }

  const planFeeCents = PLAN_FEE_CENTS[planKey];

  if (typeof planFeeCents === "number") {
    return formatCents(planFeeCents * safeQuantity);
  }

  return feeLabel;
}

function getStatusLabel(status: DepositInvoiceStatus) {
  if (status === "processing") return "processing";
  if (status === "refunded") return "refunded";
  if (status === "underpaid") return "underpaid";
  return status;
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

function getPaymentSubtitle({
  invoice,
  isPromoInvoice,
}: {
  invoice: DepositInvoice;
  isPromoInvoice: boolean;
}) {
  if (isPromoInvoice) {
    return "Your promo code covered the full evaluation fee";
  }

  if (invoice.status === "paid") {
    return "Payment complete";
  }

  if (invoice.status === "underpaid") {
    return "Payment settled below the minimum accepted amount";
  }

  if (invoice.status === "expired") {
    return "This deposit quote expired before payment was detected";
  }

  if (invoice.status === "refunded") {
    return "Relay refunded this payment";
  }

  if (invoice.status === "failed" || invoice.status === "invalid") {
    return "This payment could not be completed";
  }

  return "Send the quoted amount";
}

function StatusPill({ status }: { status: DepositInvoiceStatus }) {
  return (
    <div className="rounded-full bg-zinc-900 px-3 py-1 text-[12px] font-semibold capitalize text-zinc-300 hidden">
      {getStatusLabel(status)}
    </div>
  );
}

function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100"
    />
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
    <div className="relative rounded-2xl bg-black/30 p-4">
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
        className="h-12 w-full translate-y-[-2px] cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 text-[15px] font-semibold text-zinc-100 transition-[transform,opacity] duration-100 hover:translate-y-[-1px] active:translate-y-0 disabled:cursor-not-allowed"
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

function QuantitySelector({
  quantity,
  disabled,
  onChange,
}: {
  quantity: number;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  const safeQuantity = clampAccountQuantity(quantity);

  function adjustQuantity(delta: number) {
    onChange(clampAccountQuantity(safeQuantity + delta));
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-none text-zinc-100">
            Quantity
          </div>

          <div className="mt-1 text-[12px] leading-4 text-zinc-500">
            Buy up to {MAX_ACCOUNT_QUANTITY} accounts at once
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => adjustQuantity(-1)}
            disabled={disabled || safeQuantity <= 1}
            className="grid h-8 w-8 cursor-pointer place-items-center bg-transparent text-[18px] font-semibold leading-none text-zinc-300 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Decrease account quantity"
          >
            −
          </button>

          <div className="grid h-8 min-w-10 place-items-center px-2 text-[15px] font-semibold tabular-nums text-zinc-100">
            {safeQuantity}
          </div>

          <button
            type="button"
            onClick={() => adjustQuantity(1)}
            disabled={disabled || safeQuantity >= MAX_ACCOUNT_QUANTITY}
            className="grid h-8 w-8 cursor-pointer place-items-center bg-transparent text-[18px] font-semibold leading-none text-zinc-300 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Increase account quantity"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutContent({
  feeLabel,
  planKey,
  accountQuantity,
  onAccountQuantityChange,
  step,
  onStartDifferentDeposit,
  invoice,
  copied,
  countdown,
  creatingChain,
  createInvoice,
  copyText,
  openAccount,
  promoCode,
  appliedPromo,
  isApplyingPromo,
  onPromoCodeChange,
  applyPromoCode,
}: {
  feeLabel: string;
  planKey: PlanKey;
  accountQuantity: number;
  onAccountQuantityChange: (quantity: number) => void;
  step: DepositStep;
  onStartDifferentDeposit: () => void;
  invoice: DepositInvoice | null;
  copied: string | null;
  countdown: string;
  creatingChain: DepositChain | null;
  createInvoice: (chain: DepositChain) => void;
  copyText: (label: string, value: string) => void;
  openAccount: (accountId: string) => void;
  promoCode: string;
  appliedPromo: PromoPreview | null;
  isApplyingPromo: boolean;
  onPromoCodeChange: (value: string) => void;
  applyPromoCode: () => void;
}) {
  const cleanPromoCode = normalizePromoInput(promoCode);
  const displayFeeLabel = getDiscountedFeeLabel({
    feeLabel,
    appliedPromo,
    invoice,
    accountQuantity,
    planKey,
  });
  const isPromoApplied =
    Boolean(appliedPromo?.code) && appliedPromo?.code === cleanPromoCode;
  const isFreePromoApplied = isPromoApplied && appliedPromo?.finalCents === 0;
  const isPromoInvoice = invoice?.provider === "promo";

  return (
    <motion.div
      layout="size"
      transition={CHECKOUT_LAYOUT_TRANSITION}
      className="overflow-hidden"
    >
      <AccountHero feeLabel={displayFeeLabel} planKey={planKey} />

      <motion.div
        layout="size"
        transition={CHECKOUT_LAYOUT_TRANSITION}
        className="mt-4 max-h-[calc(100dvh-176px)] overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] md:max-h-[560px] [&::-webkit-scrollbar]:hidden"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {step === "method" ? (
            <motion.div
              key="method"
              layout="position"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div>
                <h3 className="text-[18px] font-semibold leading-none tracking-tight text-zinc-50">
                  Pay with crypto
                </h3>
              </div>

              <QuantitySelector
                quantity={accountQuantity}
                disabled={Boolean(creatingChain)}
                onChange={onAccountQuantityChange}
              />

              <div className="mt-3 rounded-2xl border border-zinc-800 bg-black/30 p-3">
                <div className="flex h-10 items-center gap-2">
                  <input
                    value={promoCode}
                    onChange={(event) => onPromoCodeChange(event.target.value)}
                    placeholder="Promo code"
                    autoCapitalize="characters"
                    className="min-w-0 flex-1 bg-transparent px-1 text-[16px] font-semibold uppercase tracking-[0.08em] text-zinc-100 outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600"
                  />

                  <button
                    type="button"
                    onClick={applyPromoCode}
                    disabled={isApplyingPromo || !cleanPromoCode}
                    className="grid h-9 min-w-[74px] cursor-pointer place-items-center rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-[12px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isApplyingPromo ? (
                      <ButtonSpinner />
                    ) : isPromoApplied ? (
                      "Applied"
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>

                {isPromoApplied && appliedPromo ? (
                  <div className="mt-3 border-t border-zinc-900 pt-3">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-zinc-500">Discount</span>
                      <span className="font-semibold text-zinc-100">
                        -
                        {formatCents(
                          appliedPromo.discountCents * accountQuantity,
                        )}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[12px]">
                      <span className="text-zinc-500">New total</span>
                      <span className="font-semibold text-zinc-100">
                        {formatCents(appliedPromo.finalCents * accountQuantity)}
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
                  {creatingChain
                    ? accountQuantity === 1
                      ? "Creating account..."
                      : "Creating accounts..."
                    : accountQuantity === 1
                      ? "Create free account"
                      : `Create ${accountQuantity} free accounts`}
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
                        className="flex w-full cursor-pointer items-center rounded-2xl border border-zinc-800 bg-black/30 px-4 py-3.5 text-left transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
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
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : null}

          {step === "payment" && invoice ? (
            <motion.div
              key="payment"
              layout="position"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[18px] font-semibold leading-none tracking-tight text-zinc-50">
                    {isPromoInvoice
                      ? getAccountQuantityLabel(
                          getInvoiceAccountQuantity(invoice, accountQuantity),
                        ) + " ready"
                      : `Send ${invoice.asset}`}
                  </h3>

                  <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                    {getPaymentSubtitle({
                      invoice,
                      isPromoInvoice: Boolean(isPromoInvoice),
                    })}
                  </p>
                </div>

                <StatusPill status={invoice.status} />
              </div>

              {isPromoInvoice ? (
                <div className="mt-4 grid gap-3">
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
                      <span className="font-semibold text-zinc-100">
                        {formatCents(0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  <div className="relative rounded-2xl bg-black/30 p-4">
                    <div className="absolute right-4 top-4">
                      <CopyIconButton
                        label="amount"
                        value={invoice.expected_amount_display}
                        copied={copied}
                        onCopy={copyText}
                      />
                    </div>

                    <p className="pr-10 text-[12px] font-medium text-zinc-500">
                      Send quoted amount
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-end gap-x-2 gap-y-1 pr-10">
                      <p className="break-all text-[20px] font-semibold leading-none tracking-tight text-zinc-50">
                        {invoice.expected_amount_display}
                      </p>

                      <p className="self-end pb-[1px] text-[12px] font-bold leading-none text-zinc-400">
                        {invoice.asset}
                      </p>
                    </div>

                    {getInvoiceAccountQuantity(invoice, accountQuantity) > 1 ? (
                      <p className="mt-2 text-[12px] font-medium text-zinc-500">
                        Buys{" "}
                        {getAccountQuantityLabel(
                          getInvoiceAccountQuantity(invoice, accountQuantity),
                        )}
                      </p>
                    ) : null}
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
                    <div>
                      <p className="text-[12px] font-medium text-zinc-500">
                        Expires in
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

                    <div>
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
                <div className="mt-5">
                  <OffsetButton
                    onClick={() => openAccount(invoice.credited_account_id!)}
                  >
                    {getInvoiceAccountQuantity(invoice, accountQuantity) > 1
                      ? "Open first account"
                      : "Open account"}
                  </OffsetButton>
                </div>
              ) : null}

              {invoice.status !== "paid" ? (
                <button
                  type="button"
                  onClick={onStartDifferentDeposit}
                  className="mt-3 w-full cursor-pointer text-center text-[12px] font-medium text-zinc-500 hover:text-zinc-300"
                >
                  Start a different deposit
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default function ChallengeCta({
  cta,
  buttonStyle,
  shimmerEnabled,
  planKey,
  accountQuantity: controlledAccountQuantity,
  onAccountQuantityChange,
  inlineLayout = false,
}: ChallengeCtaProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DepositStep>("method");
  const [invoice, setInvoice] = useState<DepositInvoice | null>(null);
  const [creatingChain, setCreatingChain] = useState<DepositChain | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoPreview | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [internalAccountQuantity, setInternalAccountQuantity] = useState(1);

  const isAccountQuantityControlled =
    typeof controlledAccountQuantity === "number";

  const accountQuantity = clampAccountQuantity(
    isAccountQuantityControlled
      ? controlledAccountQuantity
      : internalAccountQuantity,
  );

  const feeLabel = getPlanFeeLabel(planKey);
  const displayFeeLabel = getDiscountedFeeLabel({
    feeLabel,
    appliedPromo,
    invoice,
    accountQuantity,
    planKey,
  });

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
    "relative inline-flex h-11 w-full -translate-y-[2px] cursor-pointer touch-manipulation items-center justify-center overflow-hidden rounded-[16px] px-4 text-[15px] font-semibold transition-transform duration-100 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70",
    getButtonFaceClassName(buttonStyle),
  ].join(" ");

  const ctaStyle = {
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
  } as const;

  function setAccountQuantity(quantity: number) {
    const nextQuantity = clampAccountQuantity(quantity);

    if (!isAccountQuantityControlled) {
      setInternalAccountQuantity(nextQuantity);
    }

    onAccountQuantityChange?.(nextQuantity);
  }

  function resetFlow() {
    setStep("method");
    setInvoice(null);
    setCopied(null);
    setCreatingChain(null);
    setPromoCode("");
    setAppliedPromo(null);
    setIsApplyingPromo(false);

    if (!isAccountQuantityControlled) {
      setInternalAccountQuantity(1);
    }
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

    if (step === "method") {
      setInvoice(null);
    }
  }

  function handleAccountQuantityChange(quantity: number) {
    setAccountQuantity(clampAccountQuantity(quantity));

    if (step === "method") {
      setInvoice(null);
    }
  }

  function startDifferentDeposit() {
    setInvoice(null);
    setCopied(null);
    setCreatingChain(null);
    setStep("method");
  }

  async function applyPromoCode() {
    if (!privyUserId || isApplyingPromo) return;

    const cleanPromoCode = normalizePromoInput(promoCode);

    if (!cleanPromoCode) {
      setAppliedPromo(null);
      return;
    }

    try {
      setIsApplyingPromo(true);

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

      const data = (await readJsonResponse(
        response,
      )) as PromoValidateResponse | null;

      if (!response.ok) {
        const message = data?.error || data?.message || "Invalid promo code.";

        setAppliedPromo(null);

        toast.error(data?.toastTitle ?? "Promo code not applied", {
          description: data?.toastDescription ?? message,
        });

        return;
      }

      if (!isPromoValidateSuccess(data)) {
        const message = data?.error || data?.message || "Invalid promo code.";

        setAppliedPromo(null);

        toast.error(data?.toastTitle ?? "Promo code not applied", {
          description: data?.toastDescription ?? message,
        });

        return;
      }

      setAppliedPromo(data);
      setPromoCode(data.code ?? cleanPromoCode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid promo code.";

      setAppliedPromo(null);

      toast.error("Promo code not applied", {
        description: message,
      });
    } finally {
      setIsApplyingPromo(false);
    }
  }

  async function createInvoice(chain: DepositChain) {
    if (!privyUserId || creatingChain) return;

    try {
      setCreatingChain(chain);

      const cleanPromoCode =
        appliedPromo?.code ?? normalizePromoInput(promoCode);

      const response = await fetch("/api/crypto-deposits/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planKey,
          chain,
          promoCode: cleanPromoCode || null,
          accountQuantity,
          privyUserId,
          email,
          walletAddress,
        }),
      });

      const data = (await readJsonResponse(
        response,
      )) as CreateDepositResponse | null;

      if (!response.ok) {
        const message =
          data?.error || data?.message || "Unable to create deposit invoice.";

        if (response.status === 409 && data?.code === "OPEN_DEPOSIT_LIMIT") {
          toast.error(data.toastTitle ?? "Two deposits already open", {
            description:
              data.toastDescription ??
              "Complete one deposit or wait for a quote to expire before starting another.",
          });

          return;
        }

        if (data?.code === "PROMO_INVALID") {
          setAppliedPromo(null);

          toast.error(data.toastTitle ?? "Promo code not applied", {
            description: data.toastDescription ?? message,
          });

          return;
        }

        toast.error(data?.toastTitle ?? "Deposit not created", {
          description: data?.toastDescription ?? message,
        });

        return;
      }

      if (!data?.invoice) {
        const message = "Deposit invoice was not returned.";

        toast.error(data?.toastTitle ?? "Deposit not created", {
          description: data?.toastDescription ?? message,
        });

        return;
      }

      setInvoice(data.invoice);
      setStep("payment");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create deposit.";

      toast.error("Deposit not created", {
        description: message,
      });
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
      toast.error("Unable to copy", {
        description: "Please copy it manually.",
      });
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
          receivedDestinationAmount:
            data.invoice.received_destination_amount_display,
          edgeMinDestinationAmount:
            data.invoice.edge_min_destination_amount_display,
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
      feeLabel={feeLabel}
      planKey={planKey}
      accountQuantity={accountQuantity}
      onAccountQuantityChange={handleAccountQuantityChange}
      step={step}
      onStartDifferentDeposit={startDifferentDeposit}
      invoice={invoice}
      copied={copied}
      countdown={countdown}
      creatingChain={creatingChain}
      createInvoice={createInvoice}
      copyText={copyText}
      openAccount={openAccount}
      promoCode={promoCode}
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
          inlineLayout
            ? "min-w-0 flex-1 rounded-[16px]"
            : "mt-4 inline-block w-full rounded-[16px]",
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
              <DrawerTitle>{displayFeeLabel}</DrawerTitle>
              <DrawerDescription>
                Choose a payment method and send a crypto deposit to start your
                challenge account purchase.
              </DrawerDescription>
            </DrawerHeader>

            <motion.div
              layout="size"
              transition={CHECKOUT_LAYOUT_TRANSITION}
              className="mx-auto w-full max-w-[520px] overflow-hidden bg-zinc-950 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-zinc-800" />

              <motion.div
                layout="size"
                transition={CHECKOUT_LAYOUT_TRANSITION}
                className="max-h-[calc(100dvh-56px)] overflow-y-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {checkoutContent}
              </motion.div>
            </motion.div>
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

          <motion.div
            layout="size"
            transition={CHECKOUT_LAYOUT_TRANSITION}
            className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl"
          >
            {checkoutContent}
          </motion.div>
        </div>
      ) : null}
    </>
  );
}