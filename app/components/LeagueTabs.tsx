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
        className="no-scrollbar relative z-30 flex w-full items-center gap-2.5 overflow-x-auto lg:hidden"
      >
        {leagues.map((item) => {
          const isActive = item.league === selectedLeague;

          return (
            <Link
              key={item.league}
              href={`/?league=${item.league}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border px-4 text-[12px] font-bold transition-colors",
                isActive
                  ? "border-zinc-700/90 text-zinc-100"
                  : "border-zinc-800/80 text-zinc-500 hover:border-zinc-700/80 hover:bg-zinc-900/30 hover:text-zinc-300",
              ].join(" ")}
            >
              {isActive ? (
                <motion.span
                  layoutId="activeMobileLeague"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 bg-zinc-800/40"
                />
              ) : null}

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