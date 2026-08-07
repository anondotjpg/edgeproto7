"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef, type MouseEvent } from "react";

type LeagueTab = {
  label: string;
  tag: number;
  league: string;
};

type LeagueTabsProps = {
  leagues: readonly LeagueTab[];
  selectedLeague: string;
  onSelectLeague: (league: string) => void;
};

export default function LeagueTabs({
  leagues,
  selectedLeague,
  onSelectLeague,
}: LeagueTabsProps) {
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const activeTab = activeTabRef.current;

    if (!activeTab) return;

    const frameId = window.requestAnimationFrame(() => {
      activeTab.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedLeague]);

  function handleLeagueClick(event: MouseEvent, league: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onSelectLeague(league);
  }

  return (
    <div className="relative">
      <nav className="relative z-10">
        <div
          className={[
            "flex w-full overflow-x-auto overflow-y-hidden",
            "px-2",
            "[-ms-overflow-style:none] [scrollbar-width:none]",
            "[&::-webkit-scrollbar]:hidden",
          ].join(" ")}
        >
          {leagues.map((item) => {
            const isActive = item.league === selectedLeague;

            return (
              <Link
                ref={isActive ? activeTabRef : undefined}
                key={item.league}
                href={`/?league=${item.league}`}
                prefetch={false}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => handleLeagueClick(event, item.league)}
                className={[
                  "relative flex h-[52px] w-auto shrink-0 scroll-mx-2 items-center justify-center px-[10.08px] text-[23.4px] leading-none transition-colors duration-150",
                  isActive ? "text-zinc-100" : "text-zinc-500",
                ].join(" ")}
              >
                <span className="relative z-10 grid whitespace-nowrap">
                  <span
                    aria-hidden="true"
                    className="invisible col-start-1 row-start-1 font-extrabold"
                  >
                    {item.label}
                  </span>

                  <span className="col-start-1 row-start-1 font-bold">
                    {item.label}
                  </span>
                </span>

                {isActive ? (
                  <motion.span
                    layoutId="activeLeagueBar"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 480,
                      damping: 38,
                      mass: 0.75,
                    }}
                    className="absolute inset-x-1 bottom-0 z-20 h-[3px] rounded-full bg-white"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[0.5px] w-screen -translate-x-1/2 bg-zinc-800 sm:hidden"
      />
    </div>
  );
}