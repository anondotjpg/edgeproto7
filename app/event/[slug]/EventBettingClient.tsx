"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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

const MARKET_COLORS_STORAGE_KEY = "edge:market-colors-enabled";
const GOLD_MARKETS_STORAGE_KEY = "edge:gold-markets-enabled";
const GOLD_MARKET_COLOR = "#cfa13a";
const GAME_START_COUNTDOWN_WINDOW_MS = 3 * 60 * 60 * 1000;
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readStoredMarketColorsEnabled() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(MARKET_COLORS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function readStoredGoldMarketsEnabled() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(GOLD_MARKETS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

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

function OddsValue({
  value,
  signClassName,
}: {
  value: string;
  signClassName: string;
}) {
  const hasSign = value.startsWith("+") || value.startsWith("-");

  if (!hasSign) return <>{value}</>;

  return (
    <>
      <span className={signClassName}>{value[0]}</span>
      <span>{value.slice(1)}</span>
    </>
  );
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
      boxShadow: "none",
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

function formatUiTeamName(value: string) {
  return value.replace(/\bPortlandFire\b/g, "Portland Fire");
}

function splitTeamNameIntoTwoLines(value: string): [string, string] {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return ["", "\u00a0"];
  if (words.length === 1) return [words[0], "\u00a0"];

  let bestSplitIndex = 1;
  let smallestLengthDifference = Number.POSITIVE_INFINITY;
  let bestTopLineIsAtLeastAsLong = false;

  for (let index = 1; index < words.length; index += 1) {
    const firstLine = words.slice(0, index).join(" ");
    const secondLine = words.slice(index).join(" ");
    const lengthDifference = Math.abs(firstLine.length - secondLine.length);
    const topLineIsAtLeastAsLong = firstLine.length >= secondLine.length;

    if (
      lengthDifference < smallestLengthDifference ||
      (lengthDifference === smallestLengthDifference &&
        topLineIsAtLeastAsLong &&
        !bestTopLineIsAtLeastAsLong)
    ) {
      smallestLengthDifference = lengthDifference;
      bestTopLineIsAtLeastAsLong = topLineIsAtLeastAsLong;
      bestSplitIndex = index;
    }
  }

  return [
    words.slice(0, bestSplitIndex).join(" "),
    words.slice(bestSplitIndex).join(" "),
  ];
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

function getMillisecondsUntilGameStart(date: string, now: number) {
  const startTimestamp = Date.parse(date);

  if (!Number.isFinite(startTimestamp)) return null;

  return startTimestamp - now;
}

function formatGameStartCountdown(date: string, now: number) {
  const millisecondsUntilStart = getMillisecondsUntilGameStart(date, now);

  if (
    millisecondsUntilStart === null ||
    millisecondsUntilStart <= 0 ||
    millisecondsUntilStart >= GAME_START_COUNTDOWN_WINDOW_MS
  ) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.floor(millisecondsUntilStart / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(
      seconds,
    ).padStart(2, "0")}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${seconds}s`;
}

function useCurrentTimestamp(enabled: boolean) {
  const [now, setNow] = useState<number | null>(null);

  useBrowserLayoutEffect(() => {
    if (!enabled) {
      setNow(null);
      return;
    }

    const updateNow = () => setNow(Date.now());

    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  return now;
}

function getGameIsLive(game: Game, now = Date.now()): boolean {
  const gameWithLiveStatus = game as GameWithLiveStatus;

  if (
    gameWithLiveStatus.isLive === true ||
    gameWithLiveStatus.is_live === true
  ) {
    return true;
  }

  const startTimestamp = Date.parse(game.commence_time);

  if (!Number.isFinite(startTimestamp)) {
    return false;
  }

  return startTimestamp <= now;
}

function getDesktopLogoClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-[38px] w-[38px] object-contain md:h-[45px] md:w-[45px]";
  }

  return "h-[38px] w-[38px] rounded-md object-contain md:h-[45px] md:w-[45px]";
}

function getDesktopLogoFallbackClassName(sportKey: string) {
  if (sportKey === "mlb") {
    return "h-[38px] w-[38px] bg-zinc-950 md:h-[45px] md:w-[45px]";
  }

  return "h-[38px] w-[38px] rounded-md border border-zinc-800 bg-zinc-950 md:h-[45px] md:w-[45px]";
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

function getMarket(
  bookmaker: Game["bookmakers"][number] | undefined,
  key: string,
) {
  return bookmaker?.markets?.find((market) => market.key === key);
}

function getOutcomeByName(
  outcomes: OddsOutcome[] | undefined,
  teamName: string,
) {
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
  now,
}: {
  game: Game;
  market: OddsMarket;
  outcome?: OddsOutcome;
  teamInfo?: TeamInfo;
  now?: number | null;
}): BetSlipDataWithTeamAlias {
  const odds = formatPrice(outcome?.price);
  const impliedPercent = formatImpliedPercent(outcome?.price);
  const selectionLabel = outcome
    ? getOutcomeSelectionLabel({ market, outcome, teamInfo })
    : "Unavailable";
  const legacySide =
    market.key === "h2h" ? getLegacyH2hSide(game, outcome) : null;
  const fallbackOutcomeIndex =
    legacySide === "away" ? 0 : legacySide === "home" ? 1 : null;
  const marketMeta =
    market.polymarket ?? (market.key === "h2h" ? game.polymarket : undefined);
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
    isLive: getGameIsLive(game, now ?? Date.now()),
    matchup: `${getMarketDisplayLabel(market)} • ${game.away_team} vs. ${game.home_team}`,
    matchupAlias: `${getMarketDisplayLabel(market)} • ${getMatchupDisplayName(game)}`,
    polymarketEventId:
      marketMeta?.event_id ?? game.polymarket?.event_id ?? null,
    polymarketEventSlug:
      marketMeta?.event_slug ?? game.polymarket?.event_slug ?? null,
    polymarketMarketId:
      marketMeta?.market_id ?? game.polymarket?.market_id ?? null,
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

function EventHeader({ game, now }: { game: Game; now: number | null }) {
  const isLive = now !== null && getGameIsLive(game, now);
  const countdown =
    now === null || isLive
      ? null
      : formatGameStartCountdown(game.commence_time, now);
  const formattedStartTime = formatGameTime(game.commence_time);
  const showStartTime = now !== null && !isLive && !countdown;
  const showCountdown = now !== null && !isLive && Boolean(countdown);
  const showLive = now !== null && isLive;
  const awayTeamName = formatUiTeamName(
    game.away_team_info?.name?.trim() || game.away_team,
  );
  const homeTeamName = formatUiTeamName(
    game.home_team_info?.name?.trim() || game.home_team,
  );
  const [awayTeamLineOne, awayTeamLineTwo] =
    splitTeamNameIntoTwoLines(awayTeamName);
  const [homeTeamLineOne, homeTeamLineTwo] =
    splitTeamNameIntoTwoLines(homeTeamName);
  const longestTeamLineLength = Math.max(
    awayTeamLineOne.length,
    awayTeamLineTwo.trim().length,
    homeTeamLineOne.length,
    homeTeamLineTwo.trim().length,
  );
  const hasLongTeamLine = longestTeamLineLength >= 12;
  const hasVeryLongTeamLine = longestTeamLineLength >= 16;

  return (
    <div className="relative text-center">
      <Link
        href={getPolymarketHref(game)}
        target="_blank"
        rel="noreferrer"
        className="absolute right-0 top-0 hidden items-center gap-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:text-white"
      >
        <span>Polymarket</span>
        <FiArrowUpRight className="h-3.5 w-3.5" />
      </Link>

      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:text-[12px] hidden">
        {game.sport_title}
      </div>

      <h1
        className={[
          "mx-auto mt-3 hidden w-full items-start justify-center px-0 font-semibold leading-[1.08] tracking-tight text-white md:grid",
          hasVeryLongTeamLine
            ? "max-w-[720px] grid-cols-[minmax(0,286px)_auto_minmax(0,286px)] gap-6 text-[28px] lg:max-w-[790px] lg:grid-cols-[minmax(0,316px)_auto_minmax(0,316px)] lg:gap-7 lg:text-[31px]"
            : hasLongTeamLine
              ? "max-w-[680px] grid-cols-[minmax(0,270px)_auto_minmax(0,270px)] gap-7 text-[29px] lg:max-w-[748px] lg:grid-cols-[minmax(0,300px)_auto_minmax(0,300px)] lg:gap-8 lg:text-[33px]"
              : "max-w-[640px] grid-cols-[minmax(0,250px)_auto_minmax(0,250px)] gap-8 text-[29px] lg:max-w-[710px] lg:grid-cols-[minmax(0,280px)_auto_minmax(0,280px)] lg:gap-10 lg:text-[33px]",
        ].join(" ")}
      >
        <span className="flex min-w-0 flex-col items-center justify-start pb-[0.14em] text-center">
          <span className="block min-w-0 overflow-visible whitespace-nowrap">{awayTeamLineOne}</span>
          <span className="block min-w-0 overflow-visible whitespace-nowrap">{awayTeamLineTwo}</span>
        </span>

        <span className="self-center text-[15px] font-medium leading-none tracking-normal text-zinc-500 lg:text-[16px]">
          vs.
        </span>

        <span className="flex min-w-0 flex-col items-center justify-start pb-[0.14em] text-center">
          <span className="block min-w-0 overflow-visible whitespace-nowrap">{homeTeamLineOne}</span>
          <span className="block min-w-0 overflow-visible whitespace-nowrap">{homeTeamLineTwo}</span>
        </span>
      </h1>

      <div
        className={[
          "relative mt-2 inline-grid h-5 min-w-[210px] grid-cols-1 place-items-center text-[13px] leading-none sm:mt-3 sm:min-w-[230px] sm:text-sm",
          now === null ? "invisible" : "",
        ].join(" ")}
        title={isLive ? "Live now" : formattedStartTime}
        aria-label={
          isLive
            ? "Live now"
            : countdown
              ? `Starts in ${countdown}`
              : `Starts at ${formattedStartTime}`
        }
      >
        <span
          aria-hidden={!showStartTime}
          className={[
            "col-start-1 row-start-1 whitespace-nowrap text-zinc-400 transition-opacity duration-200",
            showStartTime ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        >
          {formattedStartTime}
        </span>

        <span
          aria-hidden={!showCountdown}
          className={[
            "col-start-1 row-start-1 whitespace-nowrap font-semibold tabular-nums text-zinc-100 transition-opacity duration-200",
            showCountdown ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        >
          {countdown ?? "0s"}
        </span>

        <span
          aria-hidden={!showLive}
          className={[
            "col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-zinc-100 transition-opacity duration-200",
            showLive ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)]" />
          <span>LIVE</span>
        </span>
      </div>
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
  const displayName = formatUiTeamName(info?.name?.trim() || team);

  return (
    <div className="flex h-[44px] items-center gap-2 py-1">
      {info?.logo ? (
        <img
          src={info.logo}
          alt={formatUiTeamName(info.name || team)}
          className={getMobileLogoClassName(sportKey)}
        />
      ) : (
        <div className={getMobileLogoFallbackClassName(sportKey)} />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 truncate text-[18.2px] font-semibold leading-tight text-zinc-100">
          {displayName}
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
  colorsEnabled,
  goldEnabled,
}: {
  betData: BetSlipDataWithTeamAlias;
  ticker: string;
  colorsEnabled: boolean;
  goldEnabled: boolean;
}) {
  const isGoldMarket = Boolean(goldEnabled && !betData.isLive);
  const displayTeamColor = isGoldMarket
    ? GOLD_MARKET_COLOR
    : colorsEnabled
      ? betData.teamColor
      : null;
  const { shellStyle, faceStyle } = getTeamColorStyles({
    color: displayTeamColor,
    selected: false,
    isLive: betData.isLive,
  });

  return (
    <div
      className={[
        "group relative rounded-lg",
        betData.isLive ? "bg-zinc-800" : "bg-zinc-800",
      ].join(" ")}
      style={{
        paddingBottom: "4px",
        ...shellStyle,
      }}
    >
      <BetSlipModal
        {...betData}
        colorsEnabled={colorsEnabled}
        goldEnabled={goldEnabled}
        teamColor={betData.teamColor}
        triggerClassName={[
          "peer flex h-[42px] w-full translate-y-[-4px] cursor-pointer items-center justify-center overflow-hidden rounded-lg px-3 text-center transition-transform duration-100 hover:translate-y-[-3px] active:translate-y-0",
          betData.isLive ? "bg-zinc-900" : "bg-zinc-900",
        ].join(" ")}
        triggerContentClassName="sr-only"
      />

      <div
        className={[
          "pointer-events-none absolute inset-0 flex translate-y-[-4px] items-center justify-center gap-1.5 rounded-lg px-3 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-3px] peer-active:translate-y-0 group-hover:translate-y-[-3px] group-active:translate-y-0",
          betData.isLive || !displayTeamColor ? "bg-zinc-900" : "",
        ].join(" ")}
        style={faceStyle}
      >
        {betData.isLive ? (
          <FaLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <>
            <span
              className={[
                "text-[12px] font-bold leading-none tracking-[0.12em]",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-200",
              ].join(" ")}
            >
              {ticker}
            </span>

            <span
              className={[
                "text-[15.6px] font-semibold leading-none tracking-tight",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
              ].join(" ")}
            >
              <OddsValue
                value={betData.odds}
                signClassName="font-medium"
              />
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
  return (
    <div
      className="group relative rounded-lg bg-zinc-800"
      style={{ paddingBottom: "4px" }}
    >
      <BetSlipModal
        {...betData}
        teamColor={betData.teamColor}
        triggerClassName="peer flex h-[42px] w-full translate-y-[-4px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-zinc-900 px-2.5 text-center transition-transform duration-100 hover:translate-y-[-3px] active:translate-y-0"
        triggerContentClassName="sr-only"
      />

      <div className="pointer-events-none absolute inset-0 flex translate-y-[-4px] items-center justify-between gap-1 rounded-lg bg-zinc-900 px-2.5 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-3px] peer-active:translate-y-0 group-hover:translate-y-[-3px] group-active:translate-y-0">
        {betData.isLive ? (
          <span className="flex w-full justify-center">
            <FaLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          </span>
        ) : (
          <>
            <span className="min-w-0 truncate text-[13.2px] font-bold leading-none tracking-[0.06em] text-zinc-300">
              {label}
            </span>

            <span className="shrink-0 text-[15.6px] font-semibold leading-none tracking-tight text-zinc-100">
              <OddsValue
                value={betData.odds}
                signClassName="font-medium"
              />
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
  colorsEnabled,
  goldEnabled,
}: {
  game: Game;
  awayBetData: BetSlipDataWithTeamAlias;
  homeBetData: BetSlipDataWithTeamAlias;
  colorsEnabled: boolean;
  goldEnabled: boolean;
}) {
  return (
    <article className="relative md:hidden">
      <div>
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
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
        />

        <MobileMoneylineModalButton
          betData={homeBetData}
          ticker={getTeamTicker(game.home_team, game.home_team_info)}
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
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
  awaySpread,
  homeSpread,
  overTotal,
  underTotal,
}: {
  spread?: OddsMarket;
  total?: OddsMarket;
  awaySpreadBetData?: BetSlipDataWithTeamAlias;
  homeSpreadBetData?: BetSlipDataWithTeamAlias;
  overTotalBetData?: BetSlipDataWithTeamAlias;
  underTotalBetData?: BetSlipDataWithTeamAlias;
  game: Game;
  awaySpread?: OddsOutcome;
  homeSpread?: OddsOutcome;
  overTotal?: OddsOutcome;
  underTotal?: OddsOutcome;
}) {
  const hasSpread = Boolean(spread && awaySpreadBetData && homeSpreadBetData);
  const hasTotal = Boolean(total && overTotalBetData && underTotalBetData);

  if (!hasSpread && !hasTotal) return null;

  return (
    <article className="grid gap-3 md:hidden">
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
              label={
                spread && awaySpread
                  ? getOutcomeButtonLabel({
                      market: spread,
                      outcome: awaySpread,
                      team: game.away_team,
                      teamInfo: game.away_team_info,
                    })
                  : getTeamTicker(game.away_team, game.away_team_info)
              }
            />

            <MobileMarketModalButton
              betData={homeSpreadBetData}
              label={
                spread && homeSpread
                  ? getOutcomeButtonLabel({
                      market: spread,
                      outcome: homeSpread,
                      team: game.home_team,
                      teamInfo: game.home_team_info,
                    })
                  : getTeamTicker(game.home_team, game.home_team_info)
              }
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
            <MobileMarketModalButton
              betData={overTotalBetData}
              label={
                total && overTotal
                  ? getOutcomeButtonLabel({ market: total, outcome: overTotal })
                  : "Over"
              }
            />
            <MobileMarketModalButton
              betData={underTotalBetData}
              label={
                total && underTotal
                  ? getOutcomeButtonLabel({
                      market: total,
                      outcome: underTotal,
                    })
                  : "Under"
              }
            />
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
    <div className="flex min-w-0 items-center gap-2.5 py-1 md:gap-3">
      {info?.logo ? (
        <img
          src={info.logo}
          alt={formatUiTeamName(info.name || team)}
          className={getDesktopLogoClassName(sportKey)}
        />
      ) : (
        <div className={getDesktopLogoFallbackClassName(sportKey)} />
      )}

      <div className="flex min-w-0 flex-col justify-center">
        <div className="truncate text-[16px] font-semibold leading-tight tracking-tight text-zinc-50 md:text-[18px] xl:text-[19px]">
          {formatUiTeamName(info?.name || team)}
        </div>

        <div
          className={[
            "mt-0.5 h-4 truncate text-[11px] font-medium leading-4 text-zinc-400 md:text-[11px]",
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
  colorsEnabled = true,
  goldEnabled = false,
  isMoneyline = false,
}: {
  selected: boolean;
  isLive?: boolean;
  teamColor?: string | null;
  label: string;
  odds: string;
  centerContent?: boolean;
  colorsEnabled?: boolean;
  goldEnabled?: boolean;
  isMoneyline?: boolean;
}) {
  const isGoldMarket = Boolean(goldEnabled && isMoneyline && !isLive);
  const displayTeamColor = isGoldMarket
    ? GOLD_MARKET_COLOR
    : colorsEnabled
      ? teamColor
      : null;
  const { shellStyle, faceStyle } = getTeamColorStyles({
    color: displayTeamColor,
    selected,
    isLive,
  });

  return (
    <div
      className={[
        "rounded-lg",
        isLive ? "bg-zinc-800" : selected ? "bg-zinc-600" : "bg-zinc-800",
      ].join(" ")}
      style={{
        paddingBottom: "2px",
        ...shellStyle,
      }}
    >
      <div
        className={[
          "flex h-[42px] w-full translate-y-[-2px] items-center overflow-hidden rounded-lg px-2.5 text-center transition-transform duration-100 hover:translate-y-[-1px] active:translate-y-0",
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
            <span
              className={[
                "min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.06em]",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-300",
              ].join(" ")}
            >
              {label}
            </span>
            <span
              className={[
                "shrink-0 text-[13px] font-bold leading-none tracking-tight",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
              ].join(" ")}
            >
              <OddsValue value={odds} signClassName="font-semibold" />
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
  colorsEnabled,
  goldEnabled,
}: {
  betData?: BetSlipDataWithTeamAlias;
  label: string;
  selected: boolean;
  onSelect: () => void;
  colorsEnabled: boolean;
  goldEnabled: boolean;
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
  const isGoldMarket = Boolean(goldEnabled && centerContent && !isLive);
  const displayTeamColor = isGoldMarket
    ? GOLD_MARKET_COLOR
    : colorsEnabled
      ? betData.teamColor
      : null;
  const { shellStyle, faceStyle } = getTeamColorStyles({
    color: displayTeamColor,
    selected,
    isLive,
  });

  return (
    <div className="relative">
      <div
        className={[
          "rounded-lg xl:hidden",
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
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
            teamColor={betData.teamColor}
            triggerClassName={[
              "peer flex h-[42px] w-full translate-y-[-2px] cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2.5 text-center transition-transform duration-100 hover:translate-y-[-1px] active:translate-y-0",
              isLive ? "bg-zinc-900" : selected ? "bg-zinc-700" : "bg-zinc-900",
            ].join(" ")}
            triggerContentClassName="sr-only"
          />

          <div
            className={[
              "pointer-events-none absolute inset-0 flex translate-y-[-2px] items-center rounded-lg px-2.5 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-1px] peer-active:translate-y-0 group-hover:translate-y-[-1px] group-active:translate-y-0",
              centerContent
                ? "justify-center gap-1.5"
                : "justify-between gap-1",
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
                <span
                  className={[
                    "min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.06em]",
                    isGoldMarket ? "text-[#120d02]" : "text-zinc-300",
                  ].join(" ")}
                >
                  {label}
                </span>
                <span
                  className={[
                    "shrink-0 text-[13px] font-bold leading-none tracking-tight",
                    isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
                  ].join(" ")}
                >
                  <OddsValue
                    value={betData.odds}
                    signClassName="font-semibold"
                  />
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
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
          isMoneyline={betData.market === "h2h"}
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
  colorsEnabled,
  goldEnabled,
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
  colorsEnabled: boolean;
  goldEnabled: boolean;
}) {
  return (
    <div className="hidden min-w-0 rounded-[28px] border border-zinc-800 bg-zinc-950 p-4 md:block md:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_124px_124px_124px] items-end gap-2 px-1 pb-2">
        <div />

        {["Moneyline", "Spread", "Total"].map((label) => (
          <div
            key={label}
            className="flex items-center justify-center pb-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_124px_124px_124px] items-center gap-2 border-t border-zinc-900/80 pt-3">
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
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
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
              betData.awaySpread &&
              isBetSelected(selectedBet, betData.awaySpread),
            )}
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
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
              betData.overTotal &&
              isBetSelected(selectedBet, betData.overTotal),
            )}
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
            onSelect={() => {
              if (betData.overTotal) onSelectBet(betData.overTotal);
            }}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_124px_124px_124px] items-center gap-2 border-t border-zinc-900/80 pt-3">
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
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
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
              betData.homeSpread &&
              isBetSelected(selectedBet, betData.homeSpread),
            )}
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
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
              betData.underTotal &&
              isBetSelected(selectedBet, betData.underTotal),
            )}
            colorsEnabled={colorsEnabled}
            goldEnabled={goldEnabled}
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
  const now = useCurrentTimestamp(true);
  const [marketColorsEnabled, setMarketColorsEnabled] = useState(true);
  const [goldMarketsEnabled, setGoldMarketsEnabled] = useState(false);
  const [marketColorsReady, setMarketColorsReady] = useState(false);
  const marketSet = useMemo(() => getMarketSet(game), [game]);

  useBrowserLayoutEffect(() => {
    const storedGoldMarketsEnabled = readStoredGoldMarketsEnabled();

    setGoldMarketsEnabled(storedGoldMarketsEnabled);
    setMarketColorsEnabled(
      storedGoldMarketsEnabled ? false : readStoredMarketColorsEnabled(),
    );
    setMarketColorsReady(true);
  }, []);

  const betData = useMemo(() => {
    return {
      awayMoneyline:
        marketSet.h2h && marketSet.awayMoneyline
          ? buildBetData({
              game,
              market: marketSet.h2h,
              outcome: marketSet.awayMoneyline,
              teamInfo: game.away_team_info,
              now,
            })
          : undefined,
      homeMoneyline:
        marketSet.h2h && marketSet.homeMoneyline
          ? buildBetData({
              game,
              market: marketSet.h2h,
              outcome: marketSet.homeMoneyline,
              teamInfo: game.home_team_info,
              now,
            })
          : undefined,
      awaySpread:
        marketSet.spread && marketSet.awaySpread
          ? buildBetData({
              game,
              market: marketSet.spread,
              outcome: marketSet.awaySpread,
              teamInfo: game.away_team_info,
              now,
            })
          : undefined,
      homeSpread:
        marketSet.spread && marketSet.homeSpread
          ? buildBetData({
              game,
              market: marketSet.spread,
              outcome: marketSet.homeSpread,
              teamInfo: game.home_team_info,
              now,
            })
          : undefined,
      overTotal:
        marketSet.total && marketSet.overTotal
          ? buildBetData({
              game,
              market: marketSet.total,
              outcome: marketSet.overTotal,
              now,
            })
          : undefined,
      underTotal:
        marketSet.total && marketSet.underTotal
          ? buildBetData({
              game,
              market: marketSet.total,
              outcome: marketSet.underTotal,
              now,
            })
          : undefined,
    };
  }, [game, marketSet, now]);

  const firstBet = useMemo(() => getFirstAvailableBet(betData), [betData]);

  const [selectedBet, setSelectedBet] =
    useState<BetSlipDataWithTeamAlias | null>(firstBet);

  useEffect(() => {
    const availableBets = Object.values(betData).filter(
      (bet): bet is BetSlipDataWithTeamAlias => Boolean(bet),
    );

    setSelectedBet((current) => {
      if (!current) return firstBet;

      const refreshedBet = availableBets.find((bet) =>
        isBetSelected(current, bet),
      );

      return refreshedBet ?? firstBet;
    });
  }, [betData, firstBet]);

  if (!marketColorsReady) return null;

  return (
    <div className="mt-5 grid gap-5 md:mt-8 md:gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:justify-center">
      <main className="min-w-0">
        <section className="space-y-3 md:space-y-4">
          <EventHeader game={game} now={now} />

          {betData.awayMoneyline && betData.homeMoneyline ? (
            <MobileMatchupCard
              game={game}
              awayBetData={betData.awayMoneyline}
              homeBetData={betData.homeMoneyline}
              colorsEnabled={marketColorsEnabled}
              goldEnabled={goldMarketsEnabled}
            />
          ) : null}

          <MobileExtraMarketsCard
            game={game}
            spread={marketSet.spread}
            total={marketSet.total}
            awaySpread={marketSet.awaySpread}
            homeSpread={marketSet.homeSpread}
            overTotal={marketSet.overTotal}
            underTotal={marketSet.underTotal}
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
            colorsEnabled={marketColorsEnabled}
            goldEnabled={goldMarketsEnabled}
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
              colorsEnabled={marketColorsEnabled}
              goldEnabled={goldMarketsEnabled}
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