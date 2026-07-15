"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

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
  const activePhoneTabRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const activeTab = activePhoneTabRef.current;

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

  return (
    <>
      {/* Actual phone screens */}
      <div className="relative z-30 w-full overflow-visible sm:hidden">
        <nav
          aria-label="Select league"
          className="no-scrollbar relative w-full overflow-x-auto overscroll-x-contain"
        >
          <div className="flex min-w-max items-stretch">
            {leagues.map((item) => {
              const isActive = item.league === selectedLeague;

              return (
                <Link
                  ref={isActive ? activePhoneTabRef : undefined}
                  key={item.league}
                  href={`/?league=${item.league}`}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "relative flex h-[42px] min-w-[78px] shrink-0 scroll-mx-0 items-center justify-center px-3 text-[15.5px] leading-none transition-colors duration-150",
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

                    <span
                      className={[
                        "col-start-1 row-start-1",
                        isActive ? "font-extrabold" : "font-bold",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </span>

                  {isActive ? (
                    <motion.span
                      layoutId="activePhoneLeagueBar"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 480,
                        damping: 38,
                        mass: 0.75,
                      }}
                      className="absolute inset-x-0 bottom-0 z-20 h-[3px] rounded-full bg-[#cfa13a]"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[0.5] w-screen -translate-x-1/2 bg-zinc-800"
        />
      </div>

      {/* Tablet and smaller desktop screens */}
      <nav
        aria-label="Select league"
        className="no-scrollbar relative z-30 hidden w-full items-center gap-2 overflow-x-auto sm:flex lg:hidden"
      >
        {leagues.map((item) => {
          const isActive = item.league === selectedLeague;

          return (
            <Link
              key={item.league}
              href={`/?league=${item.league}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative inline-flex h-9 shrink-0 items-center justify-center rounded-[11px] border px-4 text-[13px] leading-none transition-colors duration-150",
                isActive
                  ? "border-zinc-700/70 bg-zinc-800/35 text-zinc-100"
                  : "border-zinc-800 bg-zinc-950/70 text-zinc-500",
              ].join(" ")}
            >
              <span className="relative grid whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="invisible col-start-1 row-start-1 font-extrabold"
                >
                  {item.label}
                </span>

                <span
                  className={[
                    "col-start-1 row-start-1",
                    isActive ? "font-extrabold" : "font-bold",
                  ].join(" ")}
                >
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Large desktop screens */}
      <nav
        aria-label="Select league"
        className="no-scrollbar relative z-20 hidden w-min items-center gap-2 overflow-x-auto rounded-lg lg:flex"
      >
        {leagues.map((item) => {
          const isActive = item.league === selectedLeague;

          return (
            <Link
              key={item.league}
              href={`/?league=${item.league}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                isActive ? "text-white" : "text-zinc-300",
              ].join(" ")}
            >
              {isActive ? (
                <motion.span
                  layoutId="activeLeaguePill"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 m-[2px] rounded-lg bg-zinc-900"
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