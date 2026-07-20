"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FaChevronRight } from "react-icons/fa";
import { FiClock } from "react-icons/fi";
import type { Game } from "../page";

type LeagueBlock = {
  leagueKey: string;
  leagueLabel: string;
  games: Game[];
};

type LeagueMeta = {
  label: string;
  league: string;
};

type EmptyGamesStateProps = {
  leagueBlocks: readonly LeagueBlock[];
  leagues: readonly LeagueMeta[];
  selectedLeagueLabel: string;
  onSelectLeague: (league: string) => void;
  now?: number | null;
  reason?: "no-markets" | "live-hidden";
  previewCount?: number;
};

type UpcomingGame = {
  game: Game;
  leagueKey: string;
  leagueLabel: string;
  startsAt: number;
};

const EASTERN_TIME_ZONE = "America/New_York";

function hasBettableOutcome(game: Game) {
  return game.bookmakers.some((bookmaker) =>
    bookmaker.markets.some((market) =>
      market.outcomes.some(
        (outcome) =>
          Number.isFinite(outcome.price) &&
          Boolean(
            outcome.tokenId ??
              market.polymarket?.clob_token_ids[
                outcome.polymarketOutcomeIndex ?? -1
              ],
          ),
      ),
    ),
  );
}

function formatUiTeamName(value: string) {
  return value.replace(/\bPortlandFire\b/g, "Portland Fire");
}

function getTeamDisplayName(team: string, alias?: string) {
  return formatUiTeamName(alias?.trim() || team);
}

function formatStartLabel(startsAt: number, now: number) {
  const difference = Math.max(0, startsAt - now);
  const totalMinutes = Math.ceil(difference / 60_000);

  if (totalMinutes < 60) {
    return `In ${Math.max(1, totalMinutes)}m`;
  }

  if (totalMinutes < 24 * 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return minutes > 0 ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(startsAt);
}

function TeamLogo({ src, alt }: { src?: string; alt: string }) {
  return src ? (
    <img
      src={src}
      alt={alt}
      className="h-8 w-8 rounded-md object-contain sm:h-9 sm:w-9"
    />
  ) : (
    <div
      aria-hidden="true"
      className="h-8 w-8 rounded-md border border-zinc-800 bg-zinc-950 sm:h-9 sm:w-9"
    />
  );
}

function EmptyUpcomingPreview() {
  return (
    <div className="grid gap-2 sm:gap-2.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="relative h-[64px] overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/60 sm:h-[70px]"
        >
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-zinc-800/40 to-transparent"
            animate={{ x: ["-130%", "430%"] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "linear",
              delay: index * 0.14,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function EmptyGamesState({
  leagueBlocks,
  leagues,
  selectedLeagueLabel,
  onSelectLeague,
  now,
  reason = "no-markets",
  previewCount = 3,
}: EmptyGamesStateProps) {
  const reduceMotion = useReducedMotion();
  const currentTime = now ?? Date.now();

  const upcomingGames = useMemo<UpcomingGame[]>(() => {
    const leagueLabelByKey = new Map(
      leagues.map((league) => [league.league, league.label]),
    );

    return leagueBlocks
      .flatMap((league) =>
        league.games.map((game) => ({
          game,
          leagueKey: league.leagueKey,
          leagueLabel:
            leagueLabelByKey.get(league.leagueKey) ?? league.leagueLabel,
          startsAt: Date.parse(game.commence_time),
        })),
      )
      .filter(
        (item) =>
          Number.isFinite(item.startsAt) &&
          item.startsAt > currentTime &&
          hasBettableOutcome(item.game),
      )
      .sort((left, right) => left.startsAt - right.startsAt)
      .slice(0, previewCount);
  }, [currentTime, leagueBlocks, leagues, previewCount]);

  const description = "Markets will appear here as soon as they are ready.";

  return (
    <section className="mx-auto flex min-h-[360px] w-full max-w-[760px] flex-col justify-center py-4 sm:min-h-[480px] sm:py-12">
      <div className="flex flex-col items-center text-center">
        <h2 className="max-w-[620px] text-[27px] font-semibold leading-[1.08] tracking-[-0.035em] text-zinc-50 sm:text-[34px]">
          {reason === "live-hidden" ? (
            "Live games are hidden"
          ) : (
            <>
              <span className="sm:hidden">
                No {selectedLeagueLabel} markets
              </span>
              <span className="hidden sm:inline">
                No {selectedLeagueLabel} markets right now
              </span>
            </>
          )}
        </h2>

        <p className="mt-2 max-w-[540px] text-[14px] leading-5 text-zinc-500 sm:mt-3 sm:text-[15px] sm:leading-6">
          {description}
        </p>
      </div>

      <div className="mt-6 sm:mt-11">
        <div className="mb-2 flex items-center justify-between px-1 sm:mb-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#cfa13a] shadow-[0_0_10px_rgba(207,161,58,0.45)]" />
            <span className="text-[12px] font-semibold capitalize text-zinc-500">
              Up next
            </span>
          </div>
        </div>

        {upcomingGames.length > 0 ? (
          <div className="grid gap-2 sm:gap-2.5">
            {upcomingGames.map((item) => {
              const awayName = getTeamDisplayName(
                item.game.away_team,
                item.game.away_team_info?.alias,
              );
              const homeName = getTeamDisplayName(
                item.game.home_team,
                item.game.home_team_info?.alias,
              );

              return (
                <motion.button
                  key={item.game.id}
                  type="button"
                  onClick={() => onSelectLeague(item.leagueKey)}
                  whileTap={reduceMotion ? undefined : { scale: 0.992 }}
                  className="group grid min-h-[66px] w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-zinc-900 bg-zinc-950/65 px-3.5 py-2.5 text-left shadow-[0_16px_50px_rgba(0,0,0,0.16)] transition-colors hover:border-zinc-800 hover:bg-zinc-950 sm:min-h-[72px] sm:gap-4 sm:px-4 sm:py-3"
                  aria-label={`Open ${item.leagueLabel}: ${awayName} versus ${homeName}`}
                >
                  <div className="flex items-center -space-x-2">
                    <div className="relative z-10 grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 bg-[#09090b] sm:h-11 sm:w-11">
                      <TeamLogo
                        src={item.game.away_team_info?.logo}
                        alt={awayName}
                      />
                    </div>

                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 bg-[#09090b] sm:h-11 sm:w-11">
                      <TeamLogo
                        src={item.game.home_team_info?.logo}
                        alt={homeName}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-tight text-zinc-200 sm:text-[15px]">
                      {awayName}
                      <span className="px-1.5 text-zinc-600">vs.</span>
                      {homeName}
                    </div>

                    <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] font-medium text-zinc-500 sm:mt-1">
                      <span className="shrink-0 text-[#cfa13a]">
                        {item.leagueLabel}
                      </span>

                      <span
                        aria-hidden="true"
                        className="h-0.5 w-0.5 rounded-full bg-zinc-700"
                      />

                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <FiClock className="h-3 w-3 shrink-0" />
                        {formatStartLabel(item.startsAt, currentTime)}
                      </span>
                    </div>
                  </div>

                  <span className="grid h-8 w-8 place-items-center rounded-full text-zinc-600 transition-colors group-hover:text-zinc-300">
                    <FaChevronRight className="h-2.5 w-2.5" />
                  </span>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div>
            <EmptyUpcomingPreview />
            <p className="mt-3 text-center text-[13px] text-zinc-600 sm:mt-4">
              More markets are syncing now.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}