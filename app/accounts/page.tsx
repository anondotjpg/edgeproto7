"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown } from "react-icons/fi";
import ChallengeCta from "../components/ChallengeCta";
import OwnedAccountsSection from "../components/OwnedAccountsSection";
import type { PlanKey } from "@/lib/plans";

type AccountPlan = {
  planKey: PlanKey;
  sizeLabel: string;
  badge: string | null;
  feeLabel: string;
  cta: string;
};

type PlanDetail = {
  label: string;
  value: string;
  accent?: boolean;
};

type ButtonStyle = "gold" | "silver" | "default";

const ACCOUNT_PLANS: AccountPlan[] = [
  {
    planKey: "10000",
    sizeLabel: "$10,000",
    badge: "33x Your Capital",
    feeLabel: "$299",
    cta: "Start 10k Challenge",
  },
  {
    planKey: "5000",
    sizeLabel: "$5,000",
    badge: "Heating Up",
    feeLabel: "$179",
    cta: "Start 5k Challenge",
  },
  {
    planKey: "2000",
    sizeLabel: "$2,000",
    badge: "Best for Beginners",
    feeLabel: "$89",
    cta: "Start 2k Challenge",
  },
  {
    planKey: "1000",
    sizeLabel: "$1,000",
    badge: null,
    feeLabel: "$49",
    cta: "Start 1k Challenge",
  },
];

const PLAN_DETAILS: PlanDetail[] = [
  { label: "Profit Target", value: "25%", accent: true },
  { label: "Daily Loss", value: "2%" },
  { label: "Max Loss", value: "5%" },
  { label: "Max Risk/Trade", value: "5%" },
];

const PLAN_IMAGE_SRC: Record<PlanKey, string> = {
  "10000": "/10k.png",
  "5000": "/5k.png",
  "2000": "/2k.png",
  "1000": "/1k.png",
};

const PLAN_FEE_CENTS: Record<PlanKey, number> = {
  "10000": 29900,
  "5000": 17900,
  "2000": 8900,
  "1000": 4900,
};

const MAX_ACCOUNT_QUANTITY = 5;

const MOBILE_PAYMENT_LOGOS = [
  { asset: "SOL", src: "/sol.png" },
  { asset: "ETH", src: "/eth.png" },
  { asset: "BTC", src: "/btc.png" },
] as const;

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function DetailRow({
  label,
  value,
  accent,
  compact = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span
        className={[
          "font-medium text-zinc-400",
          compact
            ? "text-[12px] leading-4"
            : "text-[14px] leading-5",
        ].join(" ")}
      >
        {label}
      </span>

      <span
        className={[
          "font-semibold tabular-nums",
          compact
            ? "text-[12px] leading-4"
            : "text-[14px] leading-5",
          accent ? "text-zinc-100" : "text-zinc-300",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function MobileQuantitySelector({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <div
      className="flex h-[46px] shrink-0 items-center rounded-2xl p-[1px]"
      aria-label="Account quantity"
    >
      <div className="flex h-full items-center">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease account quantity"
          className="grid h-9 w-7 cursor-pointer place-items-center rounded-xl text-[17px] font-semibold leading-none text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>

        <span className="grid h-9 min-w-6 place-items-center text-[14px] font-semibold tabular-nums text-zinc-100">
          {quantity}
        </span>

        <button
          type="button"
          onClick={() =>
            onChange(Math.min(MAX_ACCOUNT_QUANTITY, quantity + 1))
          }
          disabled={quantity >= MAX_ACCOUNT_QUANTITY}
          aria-label="Increase account quantity"
          className="grid h-9 w-7 cursor-pointer place-items-center rounded-xl text-[17px] font-semibold leading-none text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function getButtonStyle(sizeLabel: string): ButtonStyle {
  if (sizeLabel === "$10,000") return "gold";
  if (sizeLabel === "$5,000") return "silver";
  return "default";
}

function getCardBorderClassName(style: ButtonStyle) {
  if (style === "gold") return "border-[#6b5520]";
  if (style === "silver") return "border-zinc-500";
  return "border-zinc-800";
}

function getCardGlowClassName(style: ButtonStyle) {
  if (style === "gold") {
    return "hidden lg:block absolute inset-[-1px] rounded-[24px] shadow-[0_0_30px_rgba(224,184,75,0.22),0_0_60px_rgba(224,184,75,0.1)]";
  }

  if (style === "silver") {
    return "hidden lg:block absolute inset-[-1px] rounded-[24px] shadow-[0_0_28px_rgba(255,255,255,0.16),0_0_56px_rgba(161,161,170,0.12)]";
  }

  return "";
}

function getBadgeClassName(style: ButtonStyle) {
  if (style === "gold") {
    return "border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] text-[#120d02]";
  }

  if (style === "silver") {
    return "border-zinc-400 bg-linear-to-br from-zinc-100 via-zinc-300 to-zinc-400 text-zinc-900";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

function MobileAccountCardContent({
  planKey,
  sizeLabel,
  feeLabel,
  cta,
  buttonStyle,
  shimmerEnabled,
}: AccountPlan & {
  buttonStyle: ButtonStyle;
  shimmerEnabled: boolean;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [accountQuantity, setAccountQuantity] = useState(1);

  const displayedFeeLabel = formatCents(
    PLAN_FEE_CENTS[planKey] * accountQuantity,
  );

  return (
    <div className="md:hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-h-10 items-center">
          <Image
            src={PLAN_IMAGE_SRC[planKey]}
            alt={`${sizeLabel} challenge`}
            width={112}
            height={48}
            sizes="112px"
            className="h-10 w-auto max-w-[118px] object-contain object-left"
            priority
          />
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            One Time Fee
          </p>

          <p className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight text-zinc-100">
            {displayedFeeLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex w-full items-start gap-2">
        <MobileQuantitySelector
          quantity={accountQuantity}
          onChange={setAccountQuantity}
        />

        <ChallengeCta
          cta={cta}
          buttonStyle={buttonStyle}
          shimmerEnabled={shimmerEnabled}
          planKey={planKey}
          accountQuantity={accountQuantity}
          onAccountQuantityChange={setAccountQuantity}
          inlineLayout
        />
      </div>

      <div className="mt-1">
        <div className="flex items-center justify-between gap-3 pt-1.5">
          <button
            type="button"
            aria-expanded={rulesOpen}
            onClick={() => setRulesOpen((current) => !current)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-[14px] font-medium text-zinc-300 transition-colors hover:text-zinc-500"
          >
            <span>See Rules</span>

            <motion.span
              animate={{ rotate: rulesOpen ? 180 : 0 }}
              transition={{
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="grid place-items-center text-zinc-300"
            >
              <FiChevronDown className="h-3 w-3" />
            </motion.span>
          </button>

          <div className="flex shrink-0 items-center gap-1.5" aria-label="Pay with SOL, ETH, or BTC">
            <span className="text-[10px] font-medium lowercase tracking-[0.12em] text-zinc-500">
              Pay with
            </span>

            <div className="flex items-center gap-1">
              {MOBILE_PAYMENT_LOGOS.map((payment) => (
                <div
                  key={payment.asset}
                  className="relative h-[17px] w-[17px] shrink-0 overflow-hidden rounded-full"
                >
                  <Image
                    src={payment.src}
                    alt={`${payment.asset} logo`}
                    fill
                    sizes="17px"
                    className="object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {rulesOpen ? (
            <motion.div
              key="mobile-account-rules"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: 0.24,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="overflow-hidden"
            >
              <div className="mt-1 space-y-2.5 border-t border-zinc-800 pt-3">
                {PLAN_DETAILS.map((detail) => (
                  <DetailRow
                    key={detail.label}
                    label={detail.label}
                    value={detail.value}
                    accent={detail.accent}
                    compact
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DesktopAccountCardContent({
  planKey,
  sizeLabel,
  feeLabel,
  cta,
  buttonStyle,
  shimmerEnabled,
}: AccountPlan & {
  buttonStyle: ButtonStyle;
  shimmerEnabled: boolean;
}) {
  return (
    <div className="hidden md:flex md:flex-1 md:flex-col">
      <div className="pt-1 text-center">
        <h2 className="text-[30px] font-semibold leading-none tracking-tight text-zinc-100">
          {sizeLabel}
        </h2>

        <p className="mt-1.5 text-[15px] font-medium text-zinc-500">
          Funded Account
        </p>
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-4" />

      <div className="space-y-3.5">
        {PLAN_DETAILS.map((detail) => (
          <DetailRow
            key={detail.label}
            label={detail.label}
            value={detail.value}
            accent={detail.accent}
          />
        ))}
      </div>

      <div className="mt-5 border-t border-zinc-800 pt-4" />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[16px] text-zinc-300">One Time Fee</div>

          <div className="text-right text-[22px] font-semibold text-zinc-100 sm:text-[26px]">
            {feeLabel}
          </div>
        </div>

        <ChallengeCta
          cta={cta}
          buttonStyle={buttonStyle}
          shimmerEnabled={shimmerEnabled}
          planKey={planKey}
        />

        <p className="mt-3 text-center text-[7px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Pay with card or crypto. Instant activation after payment.
        </p>
      </div>
    </div>
  );
}

function AccountCard(plan: AccountPlan) {
  const { sizeLabel, badge } = plan;
  const buttonStyle = getButtonStyle(sizeLabel);
  const shimmerEnabled =
    buttonStyle === "gold" || buttonStyle === "silver";
  const cardGlowEnabled =
    buttonStyle === "gold" || buttonStyle === "silver";

  return (
    <div className="relative">
      {cardGlowEnabled ? (
        <div
          aria-hidden="true"
          className={getCardGlowClassName(buttonStyle)}
        />
      ) : null}

      <div
        className={[
          "relative flex h-auto flex-col rounded-[18px] border bg-zinc-900/25 px-4 py-3 md:bg-zinc-950",
          "md:rounded-[24px] md:px-5 md:py-4",
          getCardBorderClassName(buttonStyle),
        ].join(" ")}
      >
        {badge ? (
          <div className="absolute left-1/2 top-0 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div
              className={[
                "whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold",
                getBadgeClassName(buttonStyle),
              ].join(" ")}
            >
              {badge}
            </div>
          </div>
        ) : null}

        <MobileAccountCardContent
          {...plan}
          buttonStyle={buttonStyle}
          shimmerEnabled={shimmerEnabled}
        />

        <DesktopAccountCardContent
          {...plan}
          buttonStyle={buttonStyle}
          shimmerEnabled={shimmerEnabled}
        />
      </div>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <>
      <style>{`
        @keyframes buttonShimmer {
          0% {
            transform: translateX(0) skewX(-20deg);
            opacity: 0;
          }

          8% {
            opacity: 0.42;
          }

          24% {
            opacity: 0.42;
          }

          38% {
            transform: translateX(520%) skewX(-20deg);
            opacity: 0;
          }

          100% {
            transform: translateX(520%) skewX(-20deg);
            opacity: 0;
          }
        }

        .accounts-page-shell {
          align-items: flex-start;
          padding-top: calc(5rem + env(safe-area-inset-top));
        }
      `}</style>

      <div className="relative min-h-screen bg-transparent text-white">
        <div className="accounts-page-shell relative z-10 flex min-h-screen">
          <div className="mx-auto w-full max-w-[1480px] px-4 pb-24 sm:px-6 md:pb-8">
            <OwnedAccountsSection />

            <div className="mb-7 hidden text-center sm:mb-10 md:block leading-[1.2]">
              <h1 className="text-[36px] font-semibold tracking-tight text-zinc-100 sm:text-[46px]">
                Beat the Odds.
              </h1>

              <p className="text-[17px] text-zinc-500 sm:text-[20px]">
                Fund your Bets
              </p>
            </div>

            <div className="grid w-full gap-3 md:grid-cols-2 md:justify-center md:gap-5 xl:grid-cols-4">
              {ACCOUNT_PLANS.map((plan) => (
                <div
                  key={plan.planKey}
                  className="w-full md:mx-auto md:max-w-[340px]"
                >
                  <AccountCard {...plan} />
                </div>
              ))}
            </div>

            <div className="mx-auto mt-8 max-w-[640px] text-center">
              <p className="text-[10px] leading-5 text-zinc-500 sm:text-[11px]">
                Edge is a performance evaluation platform for sports analysts.
                Participation involves a paid evaluation fee. Funded accounts
                are simulated environments. Past performance does not guarantee
                future results. Not financial or investment advice. Must be 18+.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}