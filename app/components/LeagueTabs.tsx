"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type LeagueTab = {
  label: string;
  tag: number;
  league: string;
};

export default function LeagueTabs({
  leagues,
  selectedLeague,
}: {
  leagues: readonly LeagueTab[];
  selectedLeague: string;
}) {
  return (
    <>
      <nav
        aria-label="Select league"
        className="no-scrollbar relative z-30 flex w-full items-center gap-2 overflow-x-auto lg:hidden"
      >
        {leagues.map((item) => {
          const isActive = item.league === selectedLeague;

          return (
            <Link
              key={item.league}
              href={`/?league=${item.league}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative inline-flex h-9 shrink-0 items-center justify-center rounded-[11px] border px-4 text-[13px] font-semibold leading-none transition-colors duration-150",
                isActive
                  ? "border-zinc-700 bg-zinc-800/90 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "border-zinc-800 bg-zinc-950/70 text-zinc-500 active:bg-zinc-900/80",
              ].join(" ")}
            >
              <span className="relative z-10 whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Select league"
        className="no-scrollbar relative z-20 hidden w-min items-center gap-4 overflow-x-auto rounded-lg lg:flex lg:gap-2"
      >
        {leagues.map((item) => {
          const isActive = item.league === selectedLeague;

          return (
            <Link
              key={item.league}
              href={`/?league=${item.league}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative shrink-0 text-[13px] font-medium transition-colors",
                "sm:rounded-full sm:px-4 sm:py-2",
                isActive
                  ? "text-white sm:text-zinc-100"
                  : "text-zinc-500 sm:text-zinc-300",
              ].join(" ")}
            >
              {isActive ? (
                <motion.span
                  layoutId="activeLeaguePill"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 m-[2px] hidden rounded-lg bg-zinc-800 sm:block"
                />
              ) : null}

              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}