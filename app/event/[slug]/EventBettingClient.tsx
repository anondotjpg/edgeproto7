"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { FaLock } from "react-icons/fa";
import BetSlipModal, {
  BetSlipPanel,
  type BetSlipData,
} from "@/app/components/BetSlipModal";
import type { Game, OddsOutcome, TeamInfo } from "./page";

type BetSlipDataWithTeamAlias = BetSlipData & {
  teamAlias?: string | null;
  isLive?: boolean;
};

type GameWithLiveStatus = Game & {
  isLive?: boolean;
  is_live?: boolean;
};

function formatGameTime(date: string) {
  const formatted = new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatted} EST`;
}

function formatPrice(price?: number) {
  if (price === undefined || price === null || price === 0) return "—";
  return price > 0 ? `+${price}` : `${price}`;
}

function getImpliedProbability(price?: number) {
  if (price === undefined || price === null || price === 0) return null;

  return price > 0
    ? 100 / (price + 100)
    : Math.abs(price) / (Math.abs(price) + 100);
}

function formatImpliedPercent(price?: number) {
  const probability = getImpliedProbability(price);

  if (probability === null) return "—";

  return `${Math.round(probability * 100)}%`;
}

function getPolymarketHref(game: Game) {
  return `https://polymarket.com/sports/${game.sport_key}/${game.slug}`;
}

function getTeamTicker(team: string, info?: TeamInfo) {
  const rawTicker = info?.abbreviation || info?.alias;

  if (rawTicker) return rawTicker.toUpperCase();

  const words = team
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  return team.slice(0, 3).toUpperCase();
}

function getTeamDisplayName(team: string, info?: TeamInfo) {
  const cleanAlias = info?.alias?.trim();

  if (cleanAlias) return cleanAlias;

  return team;
}

function getMatchupDisplayName(game: Game) {
  return `${getTeamDisplayName(
    game.away_team,
    game.away_team_info,
  )} vs. ${getTeamDisplayName(game.home_team, game.home_team_info)}`;
}

function getGameIsLive(game: Game): boolean {
  const gameWithLiveStatus = game as GameWithLiveStatus;

  if (typeof gameWithLiveStatus.isLive === "boolean") {
    return gameWithLiveStatus.isLive;
  }

  if (typeof gameWithLiveStatus.is_live === "boolean") {
    return gameWithLiveStatus.is_live;
  }

  const startTimestamp = Date.parse(game.commence_time);

  if (!Number.isFinite(startTimestamp)) {
    return false;
  }

  return startTimestamp <= Date.now();
}

function getDesktopLogoClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-14 w-14 object-contain";
  }

  return "h-14 w-14 rounded-md object-contain";
}

function getDesktopLogoFallbackClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-14 w-14 bg-zinc-950";
  }

  return "h-14 w-14 rounded-md border border-zinc-800 bg-zinc-950";
}

function getMobileLogoClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-8 w-8 rounded-sm object-contain";
  }

  return "h-8 w-8 rounded-sm object-contain";
}

function getMobileLogoFallbackClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-8 w-8 rounded-sm bg-zinc-950";
  }

  return "h-8 w-8 rounded-sm bg-zinc-950";
}

function buildBetData({
  game,
  team,
  outcome,
  side,
  info,
}: {
  game: Game;
  team: string;
  outcome?: OddsOutcome;
  side: "away" | "home";
  info?: TeamInfo;
}): BetSlipDataWithTeamAlias {
  const odds = formatPrice(outcome?.price);
  const impliedPercent = formatImpliedPercent(outcome?.price);

  const polymarketTokenId =
    side === "away"
      ? game.outcome_token_ids?.away
      : game.outcome_token_ids?.home;

  return {
    team,
    teamAlias: info?.alias ?? null,
    gameId: game.id,
    league: game.sport_key,
    market: "h2h",
    odds,
    impliedPercent,
    isLive: getGameIsLive(game),
    matchup: `${game.away_team} vs. ${game.home_team}`,
    matchupAlias: getMatchupDisplayName(game),
    polymarketEventId: game.polymarket?.event_id ?? null,
    polymarketEventSlug: game.polymarket?.event_slug ?? null,
    polymarketMarketId: game.polymarket?.market_id ?? null,
    polymarketConditionId: game.polymarket?.condition_id ?? null,
    polymarketMarketSlug: game.polymarket?.market_slug ?? null,
    polymarketOutcome: team,
    polymarketOutcomeIndex: side === "away" ? 0 : 1,
    polymarketTokenId: polymarketTokenId ?? null,
    teamLogo: info?.logo ?? null,
    teamLogoAlt: info?.name ?? team,
  };
}

function EventHeader({ game }: { game: Game }) {
  return (
    <div className="relative text-center">
      <Link
        href={getPolymarketHref(game)}
        target="_blank"
        rel="noreferrer"
        className="absolute right-0 top-0 hidden items-center gap-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:text-white md:inline-flex"
      >
        <span>Polymarket</span>
        <FiArrowUpRight className="h-3.5 w-3.5" />
      </Link>

      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:text-[12px]">
        {game.sport_title}
      </div>

      <h1 className="mx-auto mt-2 max-w-[680px] text-balance text-[30px] font-semibold leading-[0.96] tracking-tight text-white sm:mt-3 sm:text-[38px] md:text-[42px]">
        {getMatchupDisplayName(game)}
      </h1>

      <p className="mt-2 text-[13px] text-zinc-400 sm:mt-3 sm:text-sm">
        {formatGameTime(game.commence_time)}
      </p>
    </div>
  );
}

function MobileTeamRow({
  team,
  info,
  sportKey,
}: {
  team: string;
  info?: TeamInfo;
  sportKey: string;
}) {
  return (
    <div className="flex h-[44px] items-center gap-2 py-1">
      {info?.logo ? (
        <img
          src={info.logo}
          alt={info.name || team}
          className={getMobileLogoClassName(sportKey)}
        />
      ) : (
        <div className={getMobileLogoFallbackClassName(sportKey)} />
      )}

      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold leading-tight text-zinc-100">
          {info?.name || team}
        </div>

        <div
          className={[
            "mt-0.5 h-4 truncate text-[12px] leading-4 text-zinc-500",
            info?.record ? "" : "invisible",
          ].join(" ")}
        >
          {info?.record || "—"}
        </div>
      </div>
    </div>
  );
}

function MobileMoneylineModalButton({
  betData,
  ticker,
}: {
  betData: BetSlipDataWithTeamAlias;
  ticker: string;
}) {
  return (
    <div
      className={[
        "group relative rounded-xl",
        betData.isLive ? "bg-zinc-900" : "bg-zinc-800",
      ].join(" ")}
      style={{
        paddingBottom: "2px",
      }}
    >
      <BetSlipModal
        {...betData}
        triggerClassName={[
          "peer flex h-10 w-full translate-y-[-2px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border px-3 text-center transition-transform duration-100 hover:translate-y-[-1px] active:translate-y-0",
          betData.isLive
            ? "border-zinc-800 bg-zinc-950/80"
            : "border-zinc-800 bg-zinc-900",
        ].join(" ")}
        triggerContentClassName="sr-only"
      />

      <div className="pointer-events-none absolute inset-0 flex translate-y-[-2px] items-center justify-center gap-1.5 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-1px] peer-active:translate-y-0 group-hover:translate-y-[-1px] group-active:translate-y-0">
        {betData.isLive ? (
          <FaLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <>
            <span className="text-[10px] font-bold leading-none tracking-[0.12em] text-zinc-500">
              {ticker}
            </span>

            <span className="text-[18px] font-bold leading-none tracking-tight text-zinc-100">
              {betData.odds}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MobileMatchupCard({
  game,
  awayBetData,
  homeBetData,
}: {
  game: Game;
  awayBetData: BetSlipDataWithTeamAlias;
  homeBetData: BetSlipDataWithTeamAlias;
}) {
  return (
    <article className="relative rounded-xl border border-zinc-800 p-2.5 md:hidden">
      <div className="px-0.5">
        <MobileTeamRow
          team={game.away_team}
          info={game.away_team_info}
          sportKey={game.sport_key}
        />

        <MobileTeamRow
          team={game.home_team}
          info={game.home_team_info}
          sportKey={game.sport_key}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <MobileMoneylineModalButton
          betData={awayBetData}
          ticker={getTeamTicker(game.away_team, game.away_team_info)}
        />

        <MobileMoneylineModalButton
          betData={homeBetData}
          ticker={getTeamTicker(game.home_team, game.home_team_info)}
        />
      </div>
    </article>
  );
}

function DesktopTeamPanel({
  team,
  info,
  sportKey,
  betData,
  selected,
  onSelect,
}: {
  team: string;
  info?: TeamInfo;
  sportKey: string;
  betData: BetSlipDataWithTeamAlias;
  selected: boolean;
  onSelect: () => void;
}) {
  const isLive = Boolean(betData.isLive);

  return (
    <div
      className={[
        "min-w-0 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 transition-colors",
        selected ? "xl:border-zinc-600 xl:bg-zinc-900/70" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-4">
        {info?.logo ? (
          <img
            src={info.logo}
            alt={info.name || team}
            className={getDesktopLogoClassName(sportKey)}
          />
        ) : (
          <div className={getDesktopLogoFallbackClassName(sportKey)} />
        )}

        <div className="min-w-0">
          <div className="truncate text-[24px] font-semibold tracking-tight text-zinc-50">
            {info?.name || team}
          </div>

          <div
            className={[
              "mt-1 h-5 truncate text-[14px] font-medium leading-5 text-zinc-400",
              info?.record ? "" : "invisible",
            ].join(" ")}
          >
            {info?.record || "—"}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="text-[34px] font-semibold leading-none text-white">
          {betData.impliedPercent}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <span className="xl:hidden">ML</span>
            <span className="hidden xl:inline">Moneyline</span>
          </div>

          <div
            className={[
              "relative rounded-xl",
              isLive
                ? "bg-zinc-900"
                : selected
                  ? "bg-zinc-800 xl:bg-zinc-600"
                  : "bg-zinc-800",
            ].join(" ")}
            style={{
              paddingBottom: "2px",
            }}
          >
            <div className="xl:hidden">
              <BetSlipModal
                {...betData}
                triggerClassName={[
                  "flex h-[42px] min-w-[84px] translate-y-[-2px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border px-2.5 text-center transition-transform duration-100 hover:translate-y-[-1px] active:translate-y-0",
                  isLive
                    ? "border-zinc-800 bg-zinc-950/80"
                    : "border-zinc-800 bg-zinc-900",
                ].join(" ")}
                triggerContentClassName={
                  isLive
                    ? "sr-only"
                    : "text-[13px] font-semibold leading-none tracking-tight text-zinc-100"
                }
              />

              {isLive ? (
                <div className="pointer-events-none absolute inset-0 flex translate-y-[-2px] items-center justify-center">
                  <FaLock className="h-3.5 w-3.5 text-zinc-500" />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onSelect}
              disabled={isLive}
              className={[
                "hidden h-[42px] min-w-[84px] translate-y-[-2px] items-center justify-center overflow-hidden rounded-xl border px-2.5 text-center transition-transform duration-100 xl:flex",
                isLive
                  ? "cursor-not-allowed border-zinc-800 bg-zinc-950/80"
                  : selected
                    ? "cursor-pointer border-zinc-600 bg-zinc-700 hover:translate-y-[-1px] active:translate-y-0"
                    : "cursor-pointer border-zinc-800 bg-zinc-900 hover:translate-y-[-1px] active:translate-y-0",
              ].join(" ")}
            >
              {isLive ? (
                <FaLock className="h-3.5 w-3.5 text-zinc-500" />
              ) : (
                <span className="text-[13px] font-semibold leading-none tracking-tight text-zinc-100">
                  {betData.odds}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventBettingClient({
  game,
  awayMoneyline,
  homeMoneyline,
  children,
}: {
  game: Game;
  awayMoneyline?: OddsOutcome;
  homeMoneyline?: OddsOutcome;
  children?: ReactNode;
}) {
  const awayBetData = useMemo(() => {
    return buildBetData({
      game,
      team: game.away_team,
      outcome: awayMoneyline,
      side: "away",
      info: game.away_team_info,
    });
  }, [game, awayMoneyline]);

  const homeBetData = useMemo(() => {
    return buildBetData({
      game,
      team: game.home_team,
      outcome: homeMoneyline,
      side: "home",
      info: game.home_team_info,
    });
  }, [game, homeMoneyline]);

  const [selectedBet, setSelectedBet] =
    useState<BetSlipDataWithTeamAlias | null>(awayBetData);

  useEffect(() => {
    setSelectedBet(awayBetData);
  }, [awayBetData]);

  const awaySelected =
    selectedBet?.gameId === game.id && selectedBet.team === game.away_team;

  const homeSelected =
    selectedBet?.gameId === game.id && selectedBet.team === game.home_team;

  return (
    <div className="mt-5 grid gap-5 md:mt-8 md:gap-6 xl:grid-cols-[minmax(0,860px)_420px] xl:items-start xl:justify-center">
      <main className="min-w-0">
        <section className="space-y-3 md:space-y-4">
          <EventHeader game={game} />

          <MobileMatchupCard
            game={game}
            awayBetData={awayBetData}
            homeBetData={homeBetData}
          />

          <div className="hidden min-w-0 gap-4 md:grid md:grid-cols-2">
            <DesktopTeamPanel
              team={game.away_team}
              info={game.away_team_info}
              sportKey={game.sport_key}
              betData={awayBetData}
              selected={awaySelected}
              onSelect={() => setSelectedBet(awayBetData)}
            />

            <DesktopTeamPanel
              team={game.home_team}
              info={game.home_team_info}
              sportKey={game.sport_key}
              betData={homeBetData}
              selected={homeSelected}
              onSelect={() => setSelectedBet(homeBetData)}
            />
          </div>

          {children ? <div className="-mt-1 md:mt-0 md:pt-2">{children}</div> : null}
        </section>
      </main>

      <aside className="sticky top-18 hidden xl:block">
        <div
          className={[
            "overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl",
            selectedBet
              ? "border border-zinc-800"
              : "border border-transparent",
          ].join(" ")}
        >
          {selectedBet ? (
            <BetSlipPanel {...selectedBet} enabled panelMode="sidebar" />
          ) : (
            <div className="invisible p-5 text-sm text-zinc-500">
              Select a moneyline to place a bet.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}