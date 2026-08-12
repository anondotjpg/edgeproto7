"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { GoHome, GoHomeFill } from "react-icons/go";
import { HiWallet, HiOutlineWallet } from "react-icons/hi2";
import { IoStatsChart, IoStatsChartOutline } from "react-icons/io5";
import { SiCashapp } from "react-icons/si";
import { BiPurchaseTag, BiSolidPurchaseTag } from "react-icons/bi";

const MAIN_NAV_LINKS = [
  {
    label: "Dash",
    href: "/",
    ActiveIcon: GoHomeFill,
    InactiveIcon: GoHome,
    mobileIconClassName: "h-[33px] w-[33px]",
  },
  {
    label: "Accounts",
    href: "/accounts",
    ActiveIcon: HiWallet,
    InactiveIcon: HiOutlineWallet,
    mobileIconClassName: "h-[36px] w-[36px]",
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    ActiveIcon: IoStatsChart,
    InactiveIcon: IoStatsChartOutline,
    mobileIconClassName: "h-[33px] w-[33px]",
  },
  {
    label: "Payouts",
    href: "/payouts",
    ActiveIcon: SiCashapp,
    InactiveIcon: SiCashapp,
    mobileIconClassName: "h-[28px] w-[28px]",
  },
] as const;

const SECONDARY_NAV_LINKS = [
  {
    label: "Deposits",
    href: "/deposits",
    ActiveIcon: BiSolidPurchaseTag,
    InactiveIcon: BiPurchaseTag,
    mobileIconClassName: "h-[33px] w-[33px]",
  },
] as const;

const MOBILE_NAV_LINKS = [
  {
    ...MAIN_NAV_LINKS[0],
    label: "Home",
  },
  MAIN_NAV_LINKS[1],
  MAIN_NAV_LINKS[3],
] as const;

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

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-[240px] bg-[#09090b] md:block">
        <div className="flex h-full w-full flex-col border-r border-zinc-800 bg-[#09090b] px-6">
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

      {/* Bottom fade behind floating mobile nav */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[100px] md:hidden",
          "bg-gradient-to-t",
          "from-[#09090b]",
          "from-20%",
          "via-[#09090b]/80",
          "via-50%",
          "to-transparent",
        ].join(" ")}
      />

      {/* Mobile floating nav */}
      <nav
        className={[
          "fixed left-1/2 z-50 isolate md:hidden",
          "bottom-[calc(env(safe-area-inset-bottom)+10px)]",
          "w-[290px] max-w-[calc(100vw-32px)]",
          "-translate-x-1/2",
          "overflow-hidden rounded-full",
          "border border-zinc-800/80",
          "[backface-visibility:hidden]",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-0",
            "bg-[#09090b]/95 backdrop-blur",
            "[backface-visibility:hidden]",
            "[transform:translateZ(0)]",
          ].join(" ")}
        />

        <div className="relative h-[68px]">
          <div className="relative z-10 grid h-full grid-cols-3">
            {MOBILE_NAV_LINKS.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              const Icon = isActive ? item.ActiveIcon : item.InactiveIcon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className={[
                    "flex h-full items-center justify-center outline-none transition-colors",
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