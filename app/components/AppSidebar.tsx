"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { GoHomeFill } from "react-icons/go";
import { MdAccountBalanceWallet } from "react-icons/md";
import { IoStatsChart } from "react-icons/io5";
import { SiCashapp } from "react-icons/si";
import { BiSolidPurchaseTag } from "react-icons/bi";

const MAIN_NAV_LINKS = [
  {
    label: "Dash",
    href: "/",
    Icon: GoHomeFill,
    mobileIconClassName: "h-[28px] w-[28px]",
  },
  {
    label: "Accounts",
    href: "/accounts",
    Icon: MdAccountBalanceWallet,
    mobileIconClassName: "h-[28px] w-[28px]",
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    Icon: IoStatsChart,
    mobileIconClassName: "h-[29px] w-[29px]",
  },
  {
    label: "Payouts",
    href: "/payouts",
    Icon: SiCashapp,
    mobileIconClassName: "h-[23px] w-[23px]",
  },
] as const;

const SECONDARY_NAV_LINKS = [
  {
    label: "Deposits",
    href: "/deposits",
    Icon: BiSolidPurchaseTag,
    mobileIconClassName: "h-[29px] w-[29px]",
  },
] as const;

const MOBILE_NAV_LINKS = [...MAIN_NAV_LINKS, ...SECONDARY_NAV_LINKS] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopNavLink({
  label,
  href,
  secondary = false,
}: {
  label: string;
  href: string;
  secondary?: boolean;
}) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      className={[
        "group flex w-full items-center rounded-md outline-none transition-colors",
        "focus:outline-none focus-visible:outline-none",
        secondary ? "h-[36px]" : "h-[42px]",
        isActive
          ? "text-zinc-100"
          : secondary
            ? "text-zinc-600 hover:text-zinc-300"
            : "text-zinc-500 hover:text-zinc-200",
      ].join(" ")}
    >
      <span
        className={[
          "leading-none tracking-tight",
          secondary
            ? "text-[24px] font-semibold"
            : "text-[30px] font-semibold",
        ].join(" ")}
      >
        {label}
      </span>
    </Link>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();

  const activeIndex = MOBILE_NAV_LINKS.findIndex((item) =>
    isActivePath(pathname, item.href),
  );

  return (
    <>
      <aside className="fixed left-0 top-0 hidden h-screen w-[240px] bg-[#0b0b0d] md:block">
        <div className="flex h-full w-full flex-col border-r border-zinc-800 bg-[#0b0b0d] px-6">
          <div className="pt-5">
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="Edge"
                width={220}
                height={64}
                priority
                className="h-11 w-auto"
              />
            </div>
          </div>

          <nav className="mt-10 flex flex-col gap-1">
            {MAIN_NAV_LINKS.map((item) => (
              <DesktopNavLink
                key={item.label}
                label={item.label}
                href={item.href}
              />
            ))}

            <div className="mt-3 border-t border-zinc-800 pt-3">
              {SECONDARY_NAV_LINKS.map((item) => (
                <DesktopNavLink
                  key={item.label}
                  label={item.label}
                  href={item.href}
                  secondary
                />
              ))}
            </div>
          </nav>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t mask-t-from-[80%] border-zinc-800 bg-[#09090b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="relative mx-[3%] h-20">
          {activeIndex >= 0 ? (
            <motion.div
              className="pointer-events-none absolute inset-y-0 left-0 z-0 flex w-1/5 items-center justify-center"
              initial={false}
              animate={{ x: `${activeIndex * 100}%` }}
              transition={{
                type: "spring",
                stiffness: 430,
                damping: 36,
                mass: 0.75,
              }}
            >
              <div className="invisible h-[58px] w-[64px] rounded-[20px] bg-zinc-900" />
            </motion.div>
          ) : null}

          <div className="relative z-10 grid h-full grid-cols-5">
            {MOBILE_NAV_LINKS.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              const Icon = item.Icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className={[
                    "flex h-full items-center justify-center px-0.5 outline-none transition-colors",
                    "focus:outline-none focus-visible:outline-none",
                    isActive ? "text-zinc-100" : "text-zinc-500",
                  ].join(" ")}
                >
                  <span className="flex h-11 w-11 items-center justify-center">
                    <Icon
                      aria-hidden="true"
                      className={`${item.mobileIconClassName} block shrink-0`}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}