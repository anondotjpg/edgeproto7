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
    <div className="no-scrollbar relative z-20 flex items-center gap-4 overflow-x-auto sm:gap-2">
      {leagues.map((item) => {
        const isActive = item.league === selectedLeague;

        return (
          <Link
            key={item.league}
            href={`/?league=${item.league}`}
            className={[
              "relative shrink-0 text-[13px] transition-colors",
              "sm:rounded-full sm:px-4 sm:py-2",
              isActive
                ? "font-semibold text-white sm:text-black"
                : "font-medium text-zinc-500 sm:text-zinc-300",
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
                className="absolute inset-0 hidden rounded-full bg-white sm:block"
              />
            ) : null}

            <span className="relative z-10">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}