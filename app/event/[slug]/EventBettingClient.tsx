"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { FaLock } from "react-icons/fa";
import BetSlipModal, {
  BetSlipPanel,
  type BetSlipData,
} from "@/app/components/BetSlipModal";
import type { Game, OddsMarket, OddsOutcome, TeamInfo } from "./page";

type BetSlipDataWithTeamAlias = BetSlipData & {
  teamAlias?: string | null;
  isLive?: boolean;
  teamColor?: string | null;
  polymarketTokenId?: string | null;
};

type GameWithLiveStatus = Game & {
  isLive?: boolean;
  is_live?: boolean;
};

type MarketSet = {
  h2h?: OddsMarket;
  spread?: OddsMarket;
  total?: OddsMarket;
  awayMoneyline?: OddsOutcome;
  homeMoneyline?: OddsOutcome;
  awaySpread?: OddsOutcome;
  homeSpread?: OddsOutcome;
  overTotal?: OddsOutcome;
  underTotal?: OddsOutcome;
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

function isValidHexColor(value: string | null | undefined) {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value ?? ""));
}

function hexToRgb(value: string) {
  const hex = value.replace("#", "");

  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((value) =>
      Math.min(Math.max(Math.round(value), 0), 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function shadeHexColor(value: string, amount: number) {
  const rgb = hexToRgb(value);
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);

  return rgbToHex({
    r: rgb.r + (target - rgb.r) * mix,
    g: rgb.g + (target - rgb.g) * mix,
    b: rgb.b + (target - rgb.b) * mix,
  });
}

function getTeamColorStyles({
  color,
  selected,
  isLive,
}: {
  color?: string | null;
  selected?: boolean;
  isLive?: boolean;
}): {
  shellStyle?: CSSProperties;
  faceStyle?: CSSProperties;
} {
  if (isLive || !isValidHexColor(color)) return {};

  const safeColor = color!;

  return {
    shellStyle: {
      backgroundColor: shadeHexColor(safeColor, selected ? -0.34 : -0.52),
    },
    faceStyle: {
      backgroundColor: safeColor,
      boxShadow: `inset 0 1px 0 ${shadeHexColor(safeColor, 0.16)}`,
    },
  };
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
    return "h-12 w-12 object-contain md:h-14 md:w-14";
  }

  return "h-12 w-12 rounded-md object-contain md:h-14 md:w-14";
}

function getDesktopLogoFallbackClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-12 w-12 bg-zinc-950 md:h-14 md:w-14";
  }

  return "h-12 w-12 rounded-md border border-zinc-800 bg-zinc-950 md:h-14 md:w-14";
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

function getMarket(bookmaker: Game["bookmakers"][number] | undefined, key: string) {
  return bookmaker?.markets?.find((market) => market.key === key);
}

function getOutcomeByName(outcomes: OddsOutcome[] | undefined, teamName: string) {
  return outcomes?.find((outcome) => outcome.name === teamName);
}

function getOutcomeByOutcomeName(
  outcomes: OddsOutcome[] | undefined,
  outcomeName: string,
) {
  return outcomes?.find(
    (outcome) => outcome.name.toLowerCase() === outcomeName.toLowerCase(),
  );
}

function getMarketSet(game: Game): MarketSet {
  const bookmaker = game.bookmakers?.[0];
  const h2h = getMarket(bookmaker, "h2h");
  const spread = getMarket(bookmaker, "spreads");
  const total = getMarket(bookmaker, "totals");

  return {
    h2h,
    spread,
    total,
    awayMoneyline: getOutcomeByName(h2h?.outcomes, game.away_team),
    homeMoneyline: getOutcomeByName(h2h?.outcomes, game.home_team),
    awaySpread: getOutcomeByName(spread?.outcomes, game.away_team),
    homeSpread: getOutcomeByName(spread?.outcomes, game.home_team),
    overTotal: getOutcomeByOutcomeName(total?.outcomes, "Over"),
    underTotal: getOutcomeByOutcomeName(total?.outcomes, "Under"),
  };
}

function formatPoint(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function getMarketDisplayLabel(market?: OddsMarket) {
  if (!market) return "";
  if (market.key === "h2h") return "Moneyline";
  if (market.key === "spreads") return market.label ?? "Spread";
  if (market.key === "totals") return market.label ?? "Total";
  return market.label ?? market.key;
}

function getOutcomeSelectionLabel({
  market,
  outcome,
  teamInfo,
}: {
  market: OddsMarket;
  outcome: OddsOutcome;
  teamInfo?: TeamInfo;
}) {
  if (market.key === "spreads") {
    return `${getTeamDisplayName(outcome.name, teamInfo)} ${formatPoint(outcome.point)}`;
  }

  if (market.key === "totals") {
    return `${outcome.name} ${market.line ?? outcome.point ?? ""}`.trim();
  }

  return outcome.name;
}

function getOutcomeButtonLabel({
  market,
  outcome,
  team,
  teamInfo,
}: {
  market: OddsMarket;
  outcome?: OddsOutcome;
  team?: string;
  teamInfo?: TeamInfo;
}) {
  if (!outcome) return "—";

  if (market.key === "spreads") {
    const ticker = team ? getTeamTicker(team, teamInfo) : outcome.name;
    return `${ticker} ${formatPoint(outcome.point)}`;
  }

  if (market.key === "totals") {
    return `${outcome.name[0]?.toUpperCase() ?? ""} ${
      market.line ?? outcome.point ?? ""
    }`.trim();
  }

  if (team) return getTeamTicker(team, teamInfo);

  return outcome.name;
}

function getLegacyH2hSide(game: Game, outcome?: OddsOutcome) {
  if (!outcome) return null;
  if (outcome.name === game.away_team) return "away" as const;
  if (outcome.name === game.home_team) return "home" as const;
  return null;
}

function buildBetData({
  game,
  market,
  outcome,
  teamInfo,
}: {
  game: Game;
  market: OddsMarket;
  outcome?: OddsOutcome;
  teamInfo?: TeamInfo;
}): BetSlipDataWithTeamAlias {
  const odds = formatPrice(outcome?.price);
  const impliedPercent = formatImpliedPercent(outcome?.price);
  const selectionLabel = outcome
    ? getOutcomeSelectionLabel({ market, outcome, teamInfo })
    : "Unavailable";
  const legacySide = market.key === "h2h" ? getLegacyH2hSide(game, outcome) : null;
  const fallbackOutcomeIndex =
    legacySide === "away" ? 0 : legacySide === "home" ? 1 : null;
  const marketMeta = market.polymarket ?? (market.key === "h2h" ? game.polymarket : undefined);
  const outcomeIndex = outcome?.polymarketOutcomeIndex ?? fallbackOutcomeIndex;
  const tokenId =
    outcome?.tokenId ??
    (outcomeIndex !== null && outcomeIndex !== undefined
      ? marketMeta?.clob_token_ids?.[outcomeIndex]
      : undefined) ??
    (legacySide === "away"
      ? game.outcome_token_ids?.away
      : legacySide === "home"
        ? game.outcome_token_ids?.home
        : undefined);
  const isTeamOutcomeMarket = market.key === "h2h" || market.key === "spreads";
  const usesTeamColor = market.key === "h2h";

  return {
    team: selectionLabel,
    teamAlias: market.key === "h2h" ? (teamInfo?.alias ?? null) : null,
    gameId: game.id,
    league: game.sport_key,
    market: market.key,
    odds,
    impliedPercent,
    isLive: getGameIsLive(game),
    matchup: `${getMarketDisplayLabel(market)} • ${game.away_team} vs. ${game.home_team}`,
    matchupAlias: `${getMarketDisplayLabel(market)} • ${getMatchupDisplayName(game)}`,
    polymarketEventId: marketMeta?.event_id ?? game.polymarket?.event_id ?? null,
    polymarketEventSlug:
      marketMeta?.event_slug ?? game.polymarket?.event_slug ?? null,
    polymarketMarketId: marketMeta?.market_id ?? game.polymarket?.market_id ?? null,
    polymarketConditionId:
      marketMeta?.condition_id ?? game.polymarket?.condition_id ?? null,
    polymarketMarketSlug:
      marketMeta?.market_slug ?? game.polymarket?.market_slug ?? null,
    polymarketOutcome: outcome?.polymarketOutcome ?? outcome?.name ?? null,
    polymarketOutcomeIndex: outcomeIndex,
    polymarketTokenId: tokenId ?? null,
    teamLogo: isTeamOutcomeMarket ? (teamInfo?.logo ?? null) : null,
    teamLogoAlt: isTeamOutcomeMarket
      ? (teamInfo?.name ?? outcome?.name ?? selectionLabel)
      : null,
    teamColor: usesTeamColor ? (teamInfo?.color ?? null) : null,
  };
}

function isBetSelected(
  selectedBet: BetSlipDataWithTeamAlias | null,
  betData: BetSlipDataWithTeamAlias,
) {
  return (
    selectedBet?.gameId === betData.gameId &&
    selectedBet.market === betData.market &&
    selectedBet.polymarketTokenId === betData.polymarketTokenId
  );
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

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 truncate text-[14px] font-semibold leading-tight text-zinc-100">
          {info?.name || team}
        </div>

        {info?.record ? (
          <div className="shrink-0 text-[12px] font-medium leading-tight text-zinc-500">
            {info.record}
          </div>
        ) : null}
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
  const { shellStyle, faceStyle } = getTeamColorStyles({
    color: betData.teamColor,
    selected: false,
    isLive: betData.isLive,
  });

  return (
    <div
      className={[
        "group relative rounded-xl",
        betData.isLive ? "bg-zinc-800" : "bg-zinc-800",
      ].join(" ")}
      style={{
        paddingBottom: "4px",
        ...shellStyle,
      }}
    >
      <BetSlipModal
        {...betData}
        teamColor={betData.teamColor}
        triggerClassName={[
          "peer flex h-[42px] w-full translate-y-[-4px] cursor-pointer items-center justify-center overflow-hidden rounded-xl px-3 text-center transition-transform duration-100 hover:translate-y-[-3px] active:translate-y-0",
          betData.isLive ? "bg-zinc-900" : "bg-zinc-900",
        ].join(" ")}
        triggerContentClassName="sr-only"
      />

      <div
        className={[
          "pointer-events-none absolute inset-0 flex translate-y-[-4px] items-center justify-center gap-1.5 rounded-xl px-3 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-3px] peer-active:translate-y-0 group-hover:translate-y-[-3px] group-active:translate-y-0",
          betData.isLive ? "bg-zinc-900" : "",
        ].join(" ")}
        style={faceStyle}
      >
        {betData.isLive ? (
          <FaLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <>
            <span className="text-[10px] font-bold leading-none tracking-[0.12em] text-zinc-200">
              {ticker}
            </span>

            <span className="text-[13px] font-bold leading-none tracking-tight text-zinc-100">
              {betData.odds}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MobileMarketModalButton({
  betData,
  label,
}: {
  betData: BetSlipDataWithTeamAlias;
  label: string;
}) {
  const neutralShellStyle: CSSProperties | undefined = betData.isLive
    ? undefined
    : {
        backgroundColor: "#27272a",
      };

  const neutralFaceStyle: CSSProperties | undefined = betData.isLive
    ? undefined
    : {
        backgroundColor: "#18181b",
        boxShadow: "inset 0 1px 0 #27272a",
      };

  return (
    <div
      className={[
        "group relative rounded-xl",
        betData.isLive ? "bg-zinc-800" : "bg-zinc-800",
      ].join(" ")}
      style={{
        paddingBottom: "4px",
        ...neutralShellStyle,
      }}
    >
      <BetSlipModal
        {...betData}
        teamColor={null}
        triggerClassName={[
          "peer flex h-[42px] w-full translate-y-[-4px] cursor-pointer items-center justify-center overflow-hidden rounded-xl px-3 text-center transition-transform duration-100 hover:translate-y-[-3px] active:translate-y-0",
          betData.isLive ? "bg-zinc-900" : "bg-zinc-900",
        ].join(" ")}
        triggerContentClassName="sr-only"
      />

      <div
        className={[
          "pointer-events-none absolute inset-0 flex translate-y-[-4px] items-center justify-center gap-1.5 rounded-xl px-3 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-3px] peer-active:translate-y-0 group-hover:translate-y-[-3px] group-active:translate-y-0",
          betData.isLive ? "bg-zinc-900" : "",
        ].join(" ")}
        style={neutralFaceStyle}
      >
        {betData.isLive ? (
          <FaLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <>
            <span className="text-[10px] font-bold leading-none tracking-[0.12em] text-zinc-200">
              {label}
            </span>

            <span className="text-[13px] font-bold leading-none tracking-tight text-zinc-100">
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

function MobileExtraMarketsCard({
  spread,
  total,
  awaySpreadBetData,
  homeSpreadBetData,
  overTotalBetData,
  underTotalBetData,
  game,
}: {
  spread?: OddsMarket;
  total?: OddsMarket;
  awaySpreadBetData?: BetSlipDataWithTeamAlias;
  homeSpreadBetData?: BetSlipDataWithTeamAlias;
  overTotalBetData?: BetSlipDataWithTeamAlias;
  underTotalBetData?: BetSlipDataWithTeamAlias;
  game: Game;
}) {
  const hasSpread = Boolean(spread && awaySpreadBetData && homeSpreadBetData);
  const hasTotal = Boolean(total && overTotalBetData && underTotalBetData);

  if (!hasSpread && !hasTotal) return null;

  return (
    <article className="grid gap-3 rounded-xl border border-zinc-800 p-2.5 md:hidden">
      <div className="px-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 hidden">
        More Markets
      </div>

      {hasSpread && awaySpreadBetData && homeSpreadBetData ? (
        <div className="grid gap-2">
          <div className="px-0.5 text-[12px] font-medium leading-none text-zinc-400">
            {spread?.label ?? "Spread"}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MobileMarketModalButton
              betData={awaySpreadBetData}
              label={getTeamTicker(game.away_team, game.away_team_info)}
            />

            <MobileMarketModalButton
              betData={homeSpreadBetData}
              label={getTeamTicker(game.home_team, game.home_team_info)}
            />
          </div>
        </div>
      ) : null}

      {hasTotal && overTotalBetData && underTotalBetData ? (
        <div className="grid gap-2">
          <div className="px-0.5 text-[12px] font-medium leading-none text-zinc-400">
            {total?.label ?? "Total"}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MobileMarketModalButton betData={overTotalBetData} label="Over" />
            <MobileMarketModalButton betData={underTotalBetData} label="Under" />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DesktopTeamCell({
  team,
  info,
  sportKey,
}: {
  team: string;
  info?: TeamInfo;
  sportKey: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-1.5 md:gap-4">
      {info?.logo ? (
        <img
          src={info.logo}
          alt={info.name || team}
          className={getDesktopLogoClassName(sportKey)}
        />
      ) : (
        <div className={getDesktopLogoFallbackClassName(sportKey)} />
      )}

      <div className="flex min-w-0 flex-col justify-center">
        <div className="truncate text-[20px] font-semibold leading-tight tracking-tight text-zinc-50 md:text-[22px] xl:text-[24px]">
          {info?.name || team}
        </div>

        <div
          className={[
            "mt-0.5 h-5 truncate text-[13px] font-medium leading-5 text-zinc-400 md:text-[14px]",
            info?.record ? "" : "invisible",
          ].join(" ")}
        >
          {info?.record || "—"}
        </div>
      </div>
    </div>
  );
}

function MarketFace({
  selected,
  isLive,
  teamColor,
  label,
  odds,
  centerContent = false,
}: {
  selected: boolean;
  isLive?: boolean;
  teamColor?: string | null;
  label: string;
  odds: string;
  centerContent?: boolean;
}) {
  const { shellStyle, faceStyle } = getTeamColorStyles({
    color: teamColor,
    selected,
    isLive,
  });

  return (
    <div
      className={[
        "rounded-xl",
        isLive ? "bg-zinc-800" : selected ? "bg-zinc-600" : "bg-zinc-800",
      ].join(" ")}
      style={{
        paddingBottom: "2px",
        ...shellStyle,
      }}
    >
      <div
        className={[
          "flex h-[42px] w-full translate-y-[-2px] items-center overflow-hidden rounded-xl px-2.5 text-center transition-transform duration-100 hover:translate-y-[-1px] active:translate-y-0",
          centerContent ? "justify-center gap-1.5" : "justify-between gap-1",
          isLive
            ? "bg-zinc-900"
            : selected
              ? "bg-zinc-700"
              : "bg-zinc-900",
        ].join(" ")}
        style={faceStyle}
      >
        {isLive ? (
          <span className="flex w-full justify-center">
            <FaLock className="h-3.5 w-3.5 text-zinc-500" />
          </span>
        ) : (
          <>
            <span className="min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.06em] text-zinc-300">
              {label}
            </span>
            <span className="shrink-0 text-[13px] font-bold leading-none tracking-tight text-zinc-100">
              {odds}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function DesktopMarketCell({
  betData,
  label,
  selected,
  onSelect,
}: {
  betData?: BetSlipDataWithTeamAlias;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!betData) {
    return (
      <div className="flex h-[42px] items-center justify-center text-[13px] font-semibold text-zinc-700">
        —
      </div>
    );
  }

  const isLive = Boolean(betData.isLive);
  const centerContent = betData.market === "h2h";
  const { shellStyle, faceStyle } = getTeamColorStyles({
    color: betData.teamColor,
    selected,
    isLive,
  });

  return (
    <div className="relative">
      <div
        className={[
          "rounded-xl xl:hidden",
          isLive ? "bg-zinc-800" : selected ? "bg-zinc-600" : "bg-zinc-800",
        ].join(" ")}
        style={{
          paddingBottom: "2px",
          ...shellStyle,
        }}
      >
        <div className="group relative">
          <BetSlipModal
            {...betData}
            teamColor={betData.teamColor}
            triggerClassName={[
              "peer flex h-[42px] w-full translate-y-[-2px] cursor-pointer items-center justify-center overflow-hidden rounded-xl px-2.5 text-center transition-transform duration-100 hover:translate-y-[-1px] active:translate-y-0",
              isLive ? "bg-zinc-900" : selected ? "bg-zinc-700" : "bg-zinc-900",
            ].join(" ")}
            triggerContentClassName="sr-only"
          />

          <div
            className={[
              "pointer-events-none absolute inset-0 flex translate-y-[-2px] items-center rounded-xl px-2.5 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-1px] peer-active:translate-y-0 group-hover:translate-y-[-1px] group-active:translate-y-0",
              centerContent ? "justify-center gap-1.5" : "justify-between gap-1",
              isLive ? "bg-zinc-900" : selected ? "bg-zinc-700" : "bg-zinc-900",
            ].join(" ")}
            style={faceStyle}
          >
            {isLive ? (
              <span className="flex w-full justify-center">
                <FaLock className="h-3.5 w-3.5 text-zinc-500" />
              </span>
            ) : (
              <>
                <span className="min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.06em] text-zinc-300">
                  {label}
                </span>
                <span className="shrink-0 text-[13px] font-bold leading-none tracking-tight text-zinc-100">
                  {betData.odds}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="hidden w-full cursor-pointer xl:block"
      >
        <MarketFace
          selected={selected}
          isLive={isLive}
          teamColor={betData.teamColor}
          label={label}
          odds={betData.odds}
          centerContent={centerContent}
        />
      </button>
    </div>
  );
}

function DesktopMarketsBoard({
  game,
  marketSet,
  betData,
  selectedBet,
  onSelectBet,
}: {
  game: Game;
  marketSet: MarketSet;
  betData: {
    awayMoneyline?: BetSlipDataWithTeamAlias;
    homeMoneyline?: BetSlipDataWithTeamAlias;
    awaySpread?: BetSlipDataWithTeamAlias;
    homeSpread?: BetSlipDataWithTeamAlias;
    overTotal?: BetSlipDataWithTeamAlias;
    underTotal?: BetSlipDataWithTeamAlias;
  };
  selectedBet: BetSlipDataWithTeamAlias | null;
  onSelectBet: (bet: BetSlipDataWithTeamAlias) => void;
}) {
  return (
    <div className="hidden min-w-0 rounded-[28px] border border-zinc-800 bg-zinc-950 p-4 md:block md:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_112px_112px_112px] items-end gap-2 px-1 pb-2">
        <div />

        {["Moneyline", "Spread", "Total"].map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_112px_112px_112px] items-center gap-2 border-t border-zinc-900/80 pt-3">
          <DesktopTeamCell
            team={game.away_team}
            info={game.away_team_info}
            sportKey={game.sport_key}
          />

          <DesktopMarketCell
            betData={betData.awayMoneyline}
            label={getTeamTicker(game.away_team, game.away_team_info)}
            selected={Boolean(
              betData.awayMoneyline &&
                isBetSelected(selectedBet, betData.awayMoneyline),
            )}
            onSelect={() => {
              if (betData.awayMoneyline) onSelectBet(betData.awayMoneyline);
            }}
          />

          <DesktopMarketCell
            betData={betData.awaySpread}
            label={
              marketSet.spread && marketSet.awaySpread
                ? getOutcomeButtonLabel({
                    market: marketSet.spread,
                    outcome: marketSet.awaySpread,
                    team: game.away_team,
                    teamInfo: game.away_team_info,
                  })
                : "—"
            }
            selected={Boolean(
              betData.awaySpread && isBetSelected(selectedBet, betData.awaySpread),
            )}
            onSelect={() => {
              if (betData.awaySpread) onSelectBet(betData.awaySpread);
            }}
          />

          <DesktopMarketCell
            betData={betData.overTotal}
            label={
              marketSet.total && marketSet.overTotal
                ? getOutcomeButtonLabel({
                    market: marketSet.total,
                    outcome: marketSet.overTotal,
                  })
                : "—"
            }
            selected={Boolean(
              betData.overTotal && isBetSelected(selectedBet, betData.overTotal),
            )}
            onSelect={() => {
              if (betData.overTotal) onSelectBet(betData.overTotal);
            }}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_112px_112px_112px] items-center gap-2 border-t border-zinc-900/80 pt-3">
          <DesktopTeamCell
            team={game.home_team}
            info={game.home_team_info}
            sportKey={game.sport_key}
          />

          <DesktopMarketCell
            betData={betData.homeMoneyline}
            label={getTeamTicker(game.home_team, game.home_team_info)}
            selected={Boolean(
              betData.homeMoneyline &&
                isBetSelected(selectedBet, betData.homeMoneyline),
            )}
            onSelect={() => {
              if (betData.homeMoneyline) onSelectBet(betData.homeMoneyline);
            }}
          />

          <DesktopMarketCell
            betData={betData.homeSpread}
            label={
              marketSet.spread && marketSet.homeSpread
                ? getOutcomeButtonLabel({
                    market: marketSet.spread,
                    outcome: marketSet.homeSpread,
                    team: game.home_team,
                    teamInfo: game.home_team_info,
                  })
                : "—"
            }
            selected={Boolean(
              betData.homeSpread && isBetSelected(selectedBet, betData.homeSpread),
            )}
            onSelect={() => {
              if (betData.homeSpread) onSelectBet(betData.homeSpread);
            }}
          />

          <DesktopMarketCell
            betData={betData.underTotal}
            label={
              marketSet.total && marketSet.underTotal
                ? getOutcomeButtonLabel({
                    market: marketSet.total,
                    outcome: marketSet.underTotal,
                  })
                : "—"
            }
            selected={Boolean(
              betData.underTotal && isBetSelected(selectedBet, betData.underTotal),
            )}
            onSelect={() => {
              if (betData.underTotal) onSelectBet(betData.underTotal);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function getFirstAvailableBet(betData: {
  awayMoneyline?: BetSlipDataWithTeamAlias;
  homeMoneyline?: BetSlipDataWithTeamAlias;
  awaySpread?: BetSlipDataWithTeamAlias;
  homeSpread?: BetSlipDataWithTeamAlias;
  overTotal?: BetSlipDataWithTeamAlias;
  underTotal?: BetSlipDataWithTeamAlias;
}) {
  return (
    betData.awayMoneyline ??
    betData.homeMoneyline ??
    betData.awaySpread ??
    betData.homeSpread ??
    betData.overTotal ??
    betData.underTotal ??
    null
  );
}

export default function EventBettingClient({
  game,
  children,
}: {
  game: Game;
  children?: ReactNode;
}) {
  const marketSet = useMemo(() => getMarketSet(game), [game]);

  const betData = useMemo(() => {
    return {
      awayMoneyline:
        marketSet.h2h && marketSet.awayMoneyline
          ? buildBetData({
              game,
              market: marketSet.h2h,
              outcome: marketSet.awayMoneyline,
              teamInfo: game.away_team_info,
            })
          : undefined,
      homeMoneyline:
        marketSet.h2h && marketSet.homeMoneyline
          ? buildBetData({
              game,
              market: marketSet.h2h,
              outcome: marketSet.homeMoneyline,
              teamInfo: game.home_team_info,
            })
          : undefined,
      awaySpread:
        marketSet.spread && marketSet.awaySpread
          ? buildBetData({
              game,
              market: marketSet.spread,
              outcome: marketSet.awaySpread,
              teamInfo: game.away_team_info,
            })
          : undefined,
      homeSpread:
        marketSet.spread && marketSet.homeSpread
          ? buildBetData({
              game,
              market: marketSet.spread,
              outcome: marketSet.homeSpread,
              teamInfo: game.home_team_info,
            })
          : undefined,
      overTotal:
        marketSet.total && marketSet.overTotal
          ? buildBetData({
              game,
              market: marketSet.total,
              outcome: marketSet.overTotal,
            })
          : undefined,
      underTotal:
        marketSet.total && marketSet.underTotal
          ? buildBetData({
              game,
              market: marketSet.total,
              outcome: marketSet.underTotal,
            })
          : undefined,
    };
  }, [game, marketSet]);

  const firstBet = useMemo(() => getFirstAvailableBet(betData), [betData]);

  const [selectedBet, setSelectedBet] =
    useState<BetSlipDataWithTeamAlias | null>(firstBet);

  useEffect(() => {
    setSelectedBet(firstBet);
  }, [firstBet]);

  return (
    <div className="mt-5 grid gap-5 md:mt-8 md:gap-6 xl:grid-cols-[minmax(0,980px)_420px] xl:items-start xl:justify-center">
      <main className="min-w-0">
        <section className="space-y-3 md:space-y-4">
          <EventHeader game={game} />

          {betData.awayMoneyline && betData.homeMoneyline ? (
            <MobileMatchupCard
              game={game}
              awayBetData={betData.awayMoneyline}
              homeBetData={betData.homeMoneyline}
            />
          ) : null}

          <MobileExtraMarketsCard
            game={game}
            spread={marketSet.spread}
            total={marketSet.total}
            awaySpreadBetData={betData.awaySpread}
            homeSpreadBetData={betData.homeSpread}
            overTotalBetData={betData.overTotal}
            underTotalBetData={betData.underTotal}
          />

          <DesktopMarketsBoard
            game={game}
            marketSet={marketSet}
            betData={betData}
            selectedBet={selectedBet}
            onSelectBet={setSelectedBet}
          />

          {children ? (
            <div className="-mt-1 md:mt-0 md:pt-2">{children}</div>
          ) : null}
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
            <BetSlipPanel
              {...selectedBet}
              teamColor={selectedBet.teamColor}
              enabled
              panelMode="sidebar"
            />
          ) : (
            <div className="invisible p-5 text-sm text-zinc-500">
              Select a market to place a bet.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}