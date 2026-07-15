"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaChevronRight, FaLock } from "react-icons/fa";
import LastUpdatedAgo from "./LastUpdatedAgo";
import LeagueTabs from "./LeagueTabs";
import BetSlipModal, { BetSlipPanel, type BetSlipData } from "./BetSlipModal";
import type { Game } from "../page";
import { FiChevronDown, FiSettings } from "react-icons/fi";

type LeagueBlock = {
  leagueKey: string;
  leagueLabel: string;
  games: Game[];
  error?: string;
};

type ApiResponse = {
  updatedAt: string;
  leagues: LeagueBlock[];
};

type LeagueMeta = {
  label: string;
  tag: number;
  league: string;
};

type OddsOutcome = {
  name: string;
  price: number;
  point?: number;
  tokenId?: string;
  polymarketOutcome?: string;
  polymarketOutcomeIndex?: number;
};

type OddsMarket = {
  key: "h2h" | "spreads" | "totals" | string;
  label?: string;
  line?: number;
  outcomes: OddsOutcome[];
  polymarket?: {
    event_id: string;
    event_slug: string | null;
    market_id: string;
    market_slug: string | null;
    condition_id: string | null;
    question: string | null;
    outcomes: string[];
    clob_token_ids: string[];
    sports_market_type?: string | null;
    volume: number | null;
    volume_24hr: number | null;
    liquidity: number | null;
  };
};

type Bookmaker = {
  markets: OddsMarket[];
};

type TeamInfo = {
  name: string;
  abbreviation?: string;
  alias?: string;
  record?: string;
  logo?: string;
  color?: string;
};

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

const HIDE_LIVE_GAMES_STORAGE_KEY = "edge:hide-live-games";
const MARKET_COLORS_STORAGE_KEY = "edge:market-colors-enabled";
const GOLD_MARKETS_STORAGE_KEY = "edge:gold-markets-enabled";
const PRO_MARKETS_STORAGE_KEY = "edge:pro-markets-enabled";
const MARKET_DISPLAY_DEFAULTS_STORAGE_KEY =
  "edge:market-display-defaults-v2";
const GOLD_MARKET_COLOR = "#cfa13a";
const GAME_START_COUNTDOWN_WINDOW_MS = 3 * 60 * 60 * 1000;
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readStoredHideLiveGames() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(HIDE_LIVE_GAMES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredHideLiveGames(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      HIDE_LIVE_GAMES_STORAGE_KEY,
      value ? "true" : "false",
    );
  } catch {
    // Ignore storage failures so the toggle still works in-memory.
  }
}

function readStoredMarketColorsEnabled() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(MARKET_COLORS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredMarketColorsEnabled(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      MARKET_COLORS_STORAGE_KEY,
      value ? "true" : "false",
    );
  } catch {
    // Ignore storage failures so the toggle still works in-memory.
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

function writeStoredGoldMarketsEnabled(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      GOLD_MARKETS_STORAGE_KEY,
      value ? "true" : "false",
    );
  } catch {
    // Ignore storage failures so the toggle still works in-memory.
  }
}

function readStoredProMarketsEnabled() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(PRO_MARKETS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeStoredProMarketsEnabled(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PRO_MARKETS_STORAGE_KEY,
      value ? "true" : "false",
    );
  } catch {
    // Ignore storage failures so the toggle still works in-memory.
  }
}

function getMarket(bookmaker: Bookmaker | undefined, marketKey: string) {
  return bookmaker?.markets.find((market) => market.key === marketKey);
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

function formatPrice(price?: number) {
  if (!price) return "—";
  return price > 0 ? `+${price}` : `${price}`;
}

function OddsText({
  value,
  numberWeightClassName = "font-bold",
  signWeightClassName = "font-semibold",
}: {
  value?: string;
  numberWeightClassName?: string;
  signWeightClassName?: string;
}) {
  const safeValue = value ?? "—";
  const hasSign =
    safeValue.startsWith("+") ||
    safeValue.startsWith("-") ||
    safeValue.startsWith("−");
  const sign = hasSign ? safeValue.slice(0, 1) : "";
  const number = hasSign ? safeValue.slice(1) : safeValue;

  return (
    <span aria-label={safeValue}>
      {sign ? (
        <span aria-hidden="true" className={signWeightClassName}>
          {sign}
        </span>
      ) : null}

      <span aria-hidden="true" className={numberWeightClassName}>
        {number}
      </span>
    </span>
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

function getGameDateKey(date: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function getTodayDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function formatGameDate(date: string) {
  if (getGameDateKey(date) === getTodayDateKey()) {
    return "Today";
  }

  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatGameTime(date: string) {
  return new Date(date).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMillisecondsUntilGameStart(date: string, now: number) {
  const startTimestamp = Date.parse(date);

  if (!Number.isFinite(startTimestamp)) return null;

  return startTimestamp - now;
}

function isGameInStartCountdownWindow(game: Game, now: number) {
  if (getGameIsLive(game)) return false;

  const millisecondsUntilStart = getMillisecondsUntilGameStart(
    game.commence_time,
    now,
  );

  return (
    millisecondsUntilStart !== null &&
    millisecondsUntilStart > 0 &&
    millisecondsUntilStart < GAME_START_COUNTDOWN_WINDOW_MS
  );
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

    // Run before the browser paints so countdown-eligible games never show
    // their regular start time for a frame first.
    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  return now;
}

type PolymarketMarketVolume = NonNullable<Game["polymarket"]> & {
  volume?: number | null;
  volume_24hr?: number | null;
  liquidity?: number | null;
};

function getMarketVolume(game: Game) {
  const polymarket = game.polymarket as PolymarketMarketVolume | undefined;
  return polymarket?.volume ?? null;
}

function formatMarketVolume(value: number | null | undefined) {
  const safeValue = Number(value);

  if (!Number.isFinite(safeValue) || safeValue < 0) return null;

  if (safeValue < 1000) {
    return `$${Math.round(safeValue).toLocaleString()} Vol.`;
  }

  if (safeValue < 1_000_000) {
    return `$${(safeValue / 1000).toFixed(2)}K Vol.`;
  }

  return `$${(safeValue / 1_000_000).toFixed(2)}M Vol.`;
}

function getLogoClassName(sportKey: string) {
  return sportKey === "mlb"
    ? "h-[30px] w-[30px] rounded-sm object-contain lg:h-7 lg:w-7"
    : "h-[30px] w-[30px] rounded-sm object-contain lg:h-7 lg:w-7";
}

function getLogoFallbackClassName(sportKey: string) {
  return sportKey === "mlb"
    ? "h-[30px] w-[30px] rounded-sm bg-zinc-950 lg:h-7 lg:w-7"
    : "h-[30px] w-[30px] rounded-sm bg-zinc-950 lg:h-7 lg:w-7";
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

  // Immediately treat the game as live when its countdown reaches zero,
  // even if the next API refresh has not marked it live yet.
  return startTimestamp <= now;
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

  return getTeamDisplayName(outcome.name, teamInfo);
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
    return `${outcome.name[0]?.toUpperCase() ?? ""} ${market.line ?? outcome.point ?? ""}`.trim();
  }

  if (team) return getTeamTicker(team, teamInfo);

  return outcome.name;
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
  const marketMeta = market.polymarket;
  const outcomeIndex = outcome?.polymarketOutcomeIndex ?? null;
  const tokenId =
    outcome?.tokenId ??
    (outcomeIndex !== null && outcomeIndex !== undefined
      ? marketMeta?.clob_token_ids[outcomeIndex]
      : undefined);
  const isTeamOutcomeMarket = market.key === "h2h" || market.key === "spreads";
  const usesTeamColor = market.key === "h2h";

  return {
    team: selectionLabel,
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
    teamAlias: null,
    teamLogo: isTeamOutcomeMarket ? (teamInfo?.logo ?? null) : null,
    teamLogoAlt: isTeamOutcomeMarket
      ? (teamInfo?.name ?? outcome?.name ?? selectionLabel)
      : null,
    teamColor: usesTeamColor ? (teamInfo?.color ?? null) : null,
  };
}

function TeamRow({
  team,
  info,
  sportKey,
}: {
  team: string;
  info?: TeamInfo;
  sportKey: string;
}) {
  const displayName = formatUiTeamName(getTeamDisplayName(team, info));

  return (
    <div className="flex h-[42px] items-center gap-2 px-0 py-0.5 lg:h-[46px] lg:gap-2.5 lg:px-2 lg:py-1">
      {info?.logo ? (
        <img
          src={info.logo}
          alt={formatUiTeamName(info.name)}
          className={getLogoClassName(sportKey)}
        />
      ) : (
        <div className={getLogoFallbackClassName(sportKey)} />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="truncate text-[15px] font-semibold leading-tight text-zinc-100 lg:text-[15px]">
          {displayName}
        </div>

        {info?.record ? (
          <div className="shrink-0 text-[14px] font-medium leading-tight text-zinc-500 lg:text-[15px]">
            {info.record}
          </div>
        ) : null}
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
  centered = false,
  colorsEnabled = true,
  goldEnabled = false,
  isMoneyline = false,
  children,
}: {
  selected: boolean;
  isLive?: boolean;
  teamColor?: string | null;
  label?: string;
  odds?: string;
  centered?: boolean;
  colorsEnabled?: boolean;
  goldEnabled?: boolean;
  isMoneyline?: boolean;
  children?: ReactNode;
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
          centered ? "justify-center gap-1.5" : "justify-between gap-1",
          isLive ? "bg-zinc-900" : selected ? "bg-zinc-700" : "bg-zinc-900",
        ].join(" ")}
        style={faceStyle}
      >
        {children ??
          (isLive ? (
            <span className="flex w-full justify-center">
              <FaLock className="h-3.5 w-3.5 text-zinc-500" />
            </span>
          ) : (
            <>
              <span
                className={[
                  "font-bold leading-none",
                  centered
                    ? "text-[11px] tracking-[0.06em]"
                    : "min-w-0 truncate text-[11px] tracking-[0.06em]",
                  isGoldMarket ? "text-[#120d02]" : "text-zinc-300",
                ].join(" ")}
              >
                {label}
              </span>
              <span
                className={[
                  "shrink-0 text-[13px] leading-none tracking-tight",
                  isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
                ].join(" ")}
              >
                <OddsText value={odds} />
              </span>
            </>
          ))}
      </div>
    </div>
  );
}

function DesktopMarketCell({
  game,
  market,
  outcome,
  team,
  teamInfo,
  selectedBet,
  onSelect,
  now,
  colorsEnabled,
  goldEnabled,
}: {
  game: Game;
  market?: OddsMarket;
  outcome?: OddsOutcome;
  team?: string;
  teamInfo?: TeamInfo;
  selectedBet: BetSlipDataWithTeamAlias | null;
  onSelect: (data: BetSlipDataWithTeamAlias) => void;
  now: number | null;
  colorsEnabled: boolean;
  goldEnabled: boolean;
}) {
  if (!market || !outcome) {
    return (
      <div className="flex h-[42px] items-center justify-center text-[13px] font-semibold text-zinc-700">
        —
      </div>
    );
  }

  const betData = buildBetData({ game, market, outcome, teamInfo, now });
  const isLive = Boolean(betData.isLive);
  const selected =
    selectedBet?.gameId === betData.gameId &&
    selectedBet.market === betData.market &&
    selectedBet.polymarketTokenId === betData.polymarketTokenId;
  const centered = market.key === "h2h";
  const label = getOutcomeButtonLabel({ market, outcome, team, teamInfo });
  const isGoldMarket = Boolean(goldEnabled && market.key === "h2h" && !isLive);
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
              centered ? "justify-center gap-1.5" : "justify-between gap-1",
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
                    "font-bold leading-none",
                    isGoldMarket ? "text-[#120d02]" : "text-zinc-300",
                    centered
                      ? "text-[11px] tracking-[0.06em]"
                      : "min-w-0 truncate text-[11px] tracking-[0.06em]",
                  ].join(" ")}
                >
                  {label}
                </span>

                <span
                  className={[
                    "shrink-0 text-[13px] leading-none tracking-tight",
                    isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
                  ].join(" ")}
                >
                  <OddsText value={betData.odds} />
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(betData)}
        className="hidden w-full cursor-pointer xl:block"
      >
        <MarketFace
          selected={selected}
          isLive={isLive}
          teamColor={betData.teamColor}
          label={label}
          odds={betData.odds}
          centered={centered}
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
          isMoneyline={market.key === "h2h"}
        />
      </button>
    </div>
  );
}

function MobileProMarketSelection({
  game,
  market,
  outcome,
  team,
  teamInfo,
  now,
  colorsEnabled,
  goldEnabled,
  divided = false,
}: {
  game: Game;
  market?: OddsMarket;
  outcome?: OddsOutcome;
  team?: string;
  teamInfo?: TeamInfo;
  now: number | null;
  colorsEnabled: boolean;
  goldEnabled: boolean;
  divided?: boolean;
}) {
  const dividerClassName = divided ? "border-l border-zinc-800" : "";

  if (!market || !outcome) {
    return (
      <div
        className={[
          "flex h-[52px] min-w-0 items-center justify-center bg-zinc-950 text-[13px] font-semibold text-zinc-700",
          dividerClassName,
        ].join(" ")}
      >
        —
      </div>
    );
  }

  const betData = buildBetData({ game, market, outcome, teamInfo, now });
  const isLive = Boolean(betData.isLive);
  const isGoldMarket = Boolean(
    goldEnabled && market.key === "h2h" && !isLive,
  );
  const displayTeamColor = isGoldMarket
    ? GOLD_MARKET_COLOR
    : colorsEnabled
      ? betData.teamColor
      : null;
  const { faceStyle } = getTeamColorStyles({
    color: displayTeamColor,
    selected: false,
    isLive,
  });
  const compactLabel = getOutcomeButtonLabel({
    market,
    outcome,
    team,
    teamInfo,
  });

  return (
    <div
      className={[
        "group relative h-[52px] min-w-0 overflow-hidden",
        dividerClassName,
      ].join(" ")}
    >
      <BetSlipModal
        {...betData}
        colorsEnabled={colorsEnabled}
        goldEnabled={goldEnabled}
        teamColor={betData.teamColor}
        triggerClassName="peer block h-[52px] w-full cursor-pointer bg-transparent"
        triggerContentClassName="sr-only"
      />

      <div
        className={[
          "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-1.5 text-center transition-colors duration-150",
          isLive
            ? "bg-zinc-950"
            : displayTeamColor
              ? ""
              : "bg-zinc-900/30 peer-hover:bg-zinc-900/80 group-hover:bg-zinc-900/80",
        ].join(" ")}
        style={faceStyle}
      >
        {isLive ? (
          <FaLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <>
            <span
              className={[
                "max-w-full truncate text-[9.5px] font-bold leading-none tracking-[0.03em] sm:text-[10.5px]",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-300",
              ].join(" ")}
            >
              {compactLabel}
            </span>

            <span
              className={[
                "text-[13.2px] leading-none tracking-tight sm:text-[14.3px]",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
              ].join(" ")}
            >
              <OddsText value={betData.odds} />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MobileProTeamRow({
  game,
  team,
  teamInfo,
  sportKey,
  moneylineMarket,
  moneylineOutcome,
  spreadMarket,
  spreadOutcome,
  totalMarket,
  totalOutcome,
  now,
  colorsEnabled,
  goldEnabled,
  rowPosition,
}: {
  game: Game;
  team: string;
  teamInfo?: TeamInfo;
  sportKey: string;
  moneylineMarket?: OddsMarket;
  moneylineOutcome?: OddsOutcome;
  spreadMarket?: OddsMarket;
  spreadOutcome?: OddsOutcome;
  totalMarket?: OddsMarket;
  totalOutcome?: OddsOutcome;
  now: number | null;
  colorsEnabled: boolean;
  goldEnabled: boolean;
  rowPosition: "top" | "bottom";
}) {
  const displayName = formatUiTeamName(getTeamDisplayName(team, teamInfo));
  const marketShellClassName =
    rowPosition === "top"
      ? "rounded-t-2xl border-x border-t border-zinc-800"
      : "rounded-b-2xl border border-zinc-800";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {teamInfo?.logo ? (
          <img
            src={teamInfo.logo}
            alt={formatUiTeamName(teamInfo.name)}
            className={getLogoClassName(sportKey)}
          />
        ) : (
          <div className={getLogoFallbackClassName(sportKey)} />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight text-zinc-100 sm:text-[15px]">
            {displayName}
          </div>

          {teamInfo?.record ? (
            <div className="mt-0.5 truncate text-[11px] font-medium leading-none text-zinc-500 sm:text-[12px]">
              {teamInfo.record}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={[
          "grid w-[199px] shrink-0 grid-cols-3 overflow-hidden bg-zinc-950 sm:w-[244px]",
          marketShellClassName,
        ].join(" ")}
      >
        <MobileProMarketSelection
          game={game}
          market={moneylineMarket}
          outcome={moneylineOutcome}
          team={team}
          teamInfo={teamInfo}
          now={now}
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
        />

        <MobileProMarketSelection
          game={game}
          market={spreadMarket}
          outcome={spreadOutcome}
          team={team}
          teamInfo={teamInfo}
          now={now}
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
          divided
        />

        <MobileProMarketSelection
          game={game}
          market={totalMarket}
          outcome={totalOutcome}
          now={now}
          colorsEnabled={colorsEnabled}
          goldEnabled={goldEnabled}
          divided
        />
      </div>
    </div>
  );
}

function MobileMarketModalButton({
  game,
  market,
  outcome,
  team,
  teamInfo,
  now,
  colorsEnabled,
  goldEnabled,
}: {
  game: Game;
  market?: OddsMarket;
  outcome?: OddsOutcome;
  team?: string;
  teamInfo?: TeamInfo;
  now: number | null;
  colorsEnabled: boolean;
  goldEnabled: boolean;
}) {
  if (!market || !outcome) {
    return (
      <div className="rounded-lg bg-zinc-900/60">
        <div className="flex h-[41px] items-center justify-center rounded-lg text-[15.6px] font-semibold text-zinc-700">
          —
        </div>
      </div>
    );
  }

  const betData = buildBetData({ game, market, outcome, teamInfo, now });
  const isGoldMarket = Boolean(
    goldEnabled && market.key === "h2h" && !betData.isLive,
  );
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
      className="group relative rounded-lg bg-zinc-800"
      style={{
        paddingBottom: "3px",
        ...shellStyle,
      }}
    >
      <BetSlipModal
        colorsEnabled={colorsEnabled}
        goldEnabled={goldEnabled}
        team={betData.team}
        teamAlias={betData.teamAlias}
        gameId={betData.gameId}
        league={betData.league}
        market={betData.market}
        odds={betData.odds}
        impliedPercent={betData.impliedPercent}
        matchup={betData.matchup}
        matchupAlias={betData.matchupAlias}
        isLive={betData.isLive}
        polymarketEventId={betData.polymarketEventId}
        polymarketEventSlug={betData.polymarketEventSlug}
        polymarketMarketId={betData.polymarketMarketId}
        polymarketConditionId={betData.polymarketConditionId}
        polymarketMarketSlug={betData.polymarketMarketSlug}
        polymarketOutcome={betData.polymarketOutcome}
        polymarketOutcomeIndex={betData.polymarketOutcomeIndex}
        polymarketTokenId={betData.polymarketTokenId}
        teamLogo={betData.teamLogo}
        teamLogoAlt={betData.teamLogoAlt}
        teamColor={betData.teamColor}
        triggerClassName={[
          "peer flex h-[41px] w-full translate-y-[-3px] cursor-pointer items-center justify-center overflow-hidden rounded-lg px-3 text-center transition-transform duration-100 hover:translate-y-[-2px] active:translate-y-0",
          betData.isLive ? "bg-zinc-900" : "bg-zinc-900",
        ].join(" ")}
        triggerContentClassName="sr-only"
      />

      <div
        className={[
          "pointer-events-none absolute inset-0 flex translate-y-[-3px] items-center justify-center gap-1.5 rounded-lg px-3 transition-transform duration-100 will-change-transform peer-hover:translate-y-[-2px] peer-active:translate-y-0 group-hover:translate-y-[-2px] group-active:translate-y-0",
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
              {getOutcomeButtonLabel({ market, outcome, team, teamInfo })}
            </span>

            <span
              className={[
                "text-[15.6px] leading-none tracking-tight",
                isGoldMarket ? "text-[#120d02]" : "text-zinc-100",
              ].join(" ")}
            >
              <OddsText
                value={betData.odds}
                numberWeightClassName="font-semibold"
                signWeightClassName="font-medium"
              />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MarketSettingsDropdown({
  proEnabled,
  colorsEnabled,
  goldEnabled,
  onTogglePro,
  onToggleColors,
  onToggleGold,
}: {
  proEnabled: boolean;
  colorsEnabled: boolean;
  goldEnabled: boolean;
  onTogglePro: () => void;
  onToggleColors: () => void;
  onToggleGold: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Market display settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-[29px] w-[29px] cursor-pointer place-items-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <FiSettings className="h-[17px] w-[17px]" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-[148px] origin-top-right rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl"
          >
            <button
              type="button"
              role="switch"
              aria-checked={proEnabled}
              onClick={onTogglePro}
              className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2 text-left transition-colors hover:bg-zinc-900"
            >
              <span className="text-[13px] font-medium text-zinc-200">Pro</span>

              <span
                className={[
                  "relative h-[17px] w-[34px] shrink-0 rounded-full p-0.5 transition-colors duration-200",
                  proEnabled ? "bg-[#cfa13a]" : "bg-zinc-800",
                ].join(" ")}
              >
                <motion.span
                  animate={{ x: proEnabled ? 17 : 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                  className="block h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={colorsEnabled}
              onClick={onToggleColors}
              className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2 text-left transition-colors hover:bg-zinc-900"
            >
              <span className="text-[13px] font-medium text-zinc-200">
                Colors
              </span>

              <span
                className={[
                  "relative h-[17px] w-[34px] shrink-0 rounded-full p-0.5 transition-colors duration-200",
                  colorsEnabled ? "bg-emerald-500" : "bg-zinc-800",
                ].join(" ")}
              >
                <motion.span
                  animate={{ x: colorsEnabled ? 17 : 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                  className="block h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={goldEnabled}
              onClick={onToggleGold}
              className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2 text-left transition-colors hover:bg-zinc-900"
            >
              <span className="text-[13px] font-medium text-zinc-200">
                Gold
              </span>

              <span
                className={[
                  "relative h-[17px] w-[34px] shrink-0 rounded-full p-0.5 transition-colors duration-200",
                  goldEnabled ? "bg-[#cfa13a]" : "bg-zinc-800",
                ].join(" ")}
              >
                <motion.span
                  animate={{ x: goldEnabled ? 17 : 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                  className="block h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                />
              </span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HideLiveToggle({
  enabled,
  onToggle,
  disabled = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={enabled}
      className="inline-flex h-[29px] shrink-0 items-center gap-[7px] text-[14.5px] font-medium leading-none text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
    >
      <span>Hide live</span>

      <span
        className={[
          "relative h-[17px] w-[34px] shrink-0 rounded-full p-0.5 transition-colors duration-200",
          enabled ? "bg-emerald-500" : "bg-zinc-800",
        ].join(" ")}
      >
        <motion.span
          animate={{ x: enabled ? 19 : 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
          className="block h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
        />
      </span>
    </button>
  );
}

function DateMarketHeader({
  date,
  games,
  action,
  now,
  showMarketLabels,
}: {
  date: string;
  games: Game[];
  action?: ReactNode;
  now: number | null;
  showMarketLabels: boolean;
}) {
  const tracksUpcomingGames = date === "Today";
  const hasCountdown =
    tracksUpcomingGames &&
    now !== null &&
    games.some((game) => isGameInStartCountdownWindow(game, now));
  const displayDate = hasCountdown ? "Upcoming" : date;

  return (
    <div className="flex items-end justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_124px_124px_124px] lg:items-end lg:gap-2">
      <div
        className={[
          "text-[20px] font-semibold leading-none tracking-tight text-zinc-100",
          tracksUpcomingGames && now === null ? "invisible" : "",
        ].join(" ")}
      >
        {displayDate}
      </div>

      {action ? <div className="shrink-0 lg:hidden">{action}</div> : null}

      {showMarketLabels
        ? ["Moneyline", "Spread", "Total"].map((label) => (
            <div
              key={label}
              className="hidden items-center justify-center pb-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 lg:flex"
            >
              {label}
            </div>
          ))
        : [0, 1, 2].map((column) => (
            <div key={column} className="hidden lg:block" aria-hidden="true" />
          ))}
    </div>
  );
}

function GameStartStatus({ game, now }: { game: Game; now: number | null }) {
  const isLive = now !== null && getGameIsLive(game, now);
  const countdown =
    now === null || isLive
      ? null
      : formatGameStartCountdown(game.commence_time, now);

  return (
    <div
      className={[
        "inline-flex h-6 shrink-0 items-center text-[14px] font-medium leading-none lg:h-7 lg:text-[14px]",
        !isLive && now === null ? "invisible" : "",
        isLive
          ? "gap-1.5 text-zinc-100"
          : countdown
            ? "font-semibold tabular-nums text-zinc-100"
            : "text-zinc-300",
      ].join(" ")}
      title={isLive ? "Live now" : formatGameTime(game.commence_time)}
      aria-label={
        isLive
          ? "Live now"
          : countdown
            ? `Starts in ${countdown}`
            : `Starts at ${formatGameTime(game.commence_time)}`
      }
    >
      {isLive ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)]" />
          <span>LIVE</span>
        </>
      ) : (
        (countdown ?? formatGameTime(game.commence_time))
      )}
    </div>
  );
}

function GameCardHeader({
  game,
  eventHref,
  now,
}: {
  game: Game;
  eventHref: string;
  now: number | null;
}) {
  const marketVolume = formatMarketVolume(getMarketVolume(game));

  return (
    <div className="mb-2 flex min-w-0 items-center justify-between gap-2.5 lg:mb-3 lg:gap-3">
      <div className="flex min-w-0 items-center gap-2 lg:gap-2.5">
        <GameStartStatus game={game} now={now} />

        {marketVolume ? (
          <div className="hidden min-w-0 truncate text-[12px] font-medium leading-none text-zinc-500 sm:text-[13px] md:block lg:text-[14px]">
            {marketVolume}
          </div>
        ) : null}
      </div>

      <Link
        href={eventHref}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-medium text-zinc-300 transition-colors hover:text-zinc-400"
      >
        <span className="lg:hidden">View</span>
        <span className="hidden lg:inline">Game View</span>
        <FaChevronRight className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}

function GameCard({
  game,
  selectedBet,
  onSelectBet,
  shouldAutoScrollOnMoreBetsOpen = false,
  now,
  colorsEnabled,
  goldEnabled,
  proEnabled,
}: {
  game: Game;
  selectedBet: BetSlipDataWithTeamAlias | null;
  onSelectBet: (data: BetSlipDataWithTeamAlias) => void;
  shouldAutoScrollOnMoreBetsOpen?: boolean;
  now: number | null;
  colorsEnabled: boolean;
  goldEnabled: boolean;
  proEnabled: boolean;
}) {
  const bookmaker = game.bookmakers[0];
  const h2h = getMarket(bookmaker, "h2h");
  const spread = getMarket(bookmaker, "spreads");
  const total = getMarket(bookmaker, "totals");

  const awayMoneyline = getOutcomeByName(h2h?.outcomes, game.away_team);
  const homeMoneyline = getOutcomeByName(h2h?.outcomes, game.home_team);
  const awaySpread = getOutcomeByName(spread?.outcomes, game.away_team);
  const homeSpread = getOutcomeByName(spread?.outcomes, game.home_team);
  const overTotal = getOutcomeByOutcomeName(total?.outcomes, "Over");
  const underTotal = getOutcomeByOutcomeName(total?.outcomes, "Under");
  const eventHref = `/event/${game.slug}`;

  const [moreBetsOpen, setMoreBetsOpen] = useState(false);
  const moreBetsOpenedByUserRef = useRef(false);
  const hasSpread = Boolean(spread && awaySpread && homeSpread);
  const hasTotal = Boolean(total && overTotal && underTotal);
  const hasMoreBets = hasSpread || hasTotal;

  function scrollToBottomAfterMoreBetsRender() {
    if (!moreBetsOpenedByUserRef.current) return;

    moreBetsOpenedByUserRef.current = false;

    if (!moreBetsOpen || !shouldAutoScrollOnMoreBetsOpen) return;
    if (typeof window === "undefined") return;

    const isMobileLayout = window.matchMedia("(max-width: 1279px)").matches;
    if (!isMobileLayout) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scrollHeight =
          document.scrollingElement?.scrollHeight ??
          document.documentElement.scrollHeight;

        window.scrollTo({
          top: scrollHeight,
          behavior: "smooth",
        });
      });
    });
  }

  return (
    <>
      <article className="relative overflow-hidden lg:hidden">
        <GameCardHeader game={game} eventHref={eventHref} now={now} />

        {proEnabled ? (
          <div className="grid gap-0">
            <MobileProTeamRow
              game={game}
              team={game.away_team}
              teamInfo={game.away_team_info}
              sportKey={game.sport_key}
              moneylineMarket={h2h}
              moneylineOutcome={awayMoneyline}
              spreadMarket={spread}
              spreadOutcome={awaySpread}
              totalMarket={total}
              totalOutcome={overTotal}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
              rowPosition="top"
            />

            <MobileProTeamRow
              game={game}
              team={game.home_team}
              teamInfo={game.home_team_info}
              sportKey={game.sport_key}
              moneylineMarket={h2h}
              moneylineOutcome={homeMoneyline}
              spreadMarket={spread}
              spreadOutcome={homeSpread}
              totalMarket={total}
              totalOutcome={underTotal}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
              rowPosition="bottom"
            />
          </div>
        ) : (
          <>
            <div>
              <TeamRow
                team={game.away_team}
                info={game.away_team_info}
                sportKey={game.sport_key}
              />

              <TeamRow
                team={game.home_team}
                info={game.home_team_info}
                sportKey={game.sport_key}
              />
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-2.5 md:gap-3">
              <MobileMarketModalButton
                game={game}
                market={h2h}
                outcome={awayMoneyline}
                team={game.away_team}
                teamInfo={game.away_team_info}
                now={now}
                colorsEnabled={colorsEnabled}
                goldEnabled={goldEnabled}
              />

              <MobileMarketModalButton
                game={game}
                market={h2h}
                outcome={homeMoneyline}
                team={game.home_team}
                teamInfo={game.home_team_info}
                now={now}
                colorsEnabled={colorsEnabled}
                goldEnabled={goldEnabled}
              />
            </div>

            {hasMoreBets ? (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMoreBetsOpen((current) => {
                      const nextValue = !current;
                      moreBetsOpenedByUserRef.current = nextValue;
                      return nextValue;
                    });
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-zinc-300 transition-colors hover:text-zinc-500"
                >
                  <span>More Bets</span>

                  <motion.span
                    animate={{ rotate: moreBetsOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="grid place-items-center text-zinc-100"
                  >
                    <FiChevronDown className="h-3 w-3" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {moreBetsOpen ? (
                    <motion.div
                      key="mobile-more-bets"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      onAnimationComplete={scrollToBottomAfterMoreBetsRender}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-3 pt-1 md:gap-3.5">
                        {hasSpread ? (
                          <div className="grid gap-2">
                            <div className="px-0.5 text-[12px] font-medium leading-none text-zinc-400">
                              {spread?.label ?? "Spread"}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                              <MobileMarketModalButton
                                game={game}
                                market={spread}
                                outcome={awaySpread}
                                team={game.away_team}
                                teamInfo={game.away_team_info}
                                now={now}
                                colorsEnabled={colorsEnabled}
                                goldEnabled={goldEnabled}
                              />

                              <MobileMarketModalButton
                                game={game}
                                market={spread}
                                outcome={homeSpread}
                                team={game.home_team}
                                teamInfo={game.home_team_info}
                                now={now}
                                colorsEnabled={colorsEnabled}
                                goldEnabled={goldEnabled}
                              />
                            </div>
                          </div>
                        ) : null}

                        {hasTotal ? (
                          <div className="grid gap-2">
                            <div className="px-0.5 text-[12px] font-medium leading-none text-zinc-400">
                              {total?.label ?? "Total"}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                              <MobileMarketModalButton
                                game={game}
                                market={total}
                                outcome={overTotal}
                                now={now}
                                colorsEnabled={colorsEnabled}
                                goldEnabled={goldEnabled}
                              />

                              <MobileMarketModalButton
                                game={game}
                                market={total}
                                outcome={underTotal}
                                now={now}
                                colorsEnabled={colorsEnabled}
                                goldEnabled={goldEnabled}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </>
        )}
      </article>

      <article className="relative hidden lg:block">
        <GameCardHeader game={game} eventHref={eventHref} now={now} />

        <div className="grid grid-cols-[minmax(0,1fr)_124px_124px_124px] gap-2">
          <div>
            <TeamRow
              team={game.away_team}
              info={game.away_team_info}
              sportKey={game.sport_key}
            />

            <TeamRow
              team={game.home_team}
              info={game.home_team_info}
              sportKey={game.sport_key}
            />
          </div>

          <div className="flex flex-col gap-2">
            <DesktopMarketCell
              game={game}
              market={h2h}
              outcome={awayMoneyline}
              team={game.away_team}
              teamInfo={game.away_team_info}
              selectedBet={selectedBet}
              onSelect={onSelectBet}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
            />

            <DesktopMarketCell
              game={game}
              market={h2h}
              outcome={homeMoneyline}
              team={game.home_team}
              teamInfo={game.home_team_info}
              selectedBet={selectedBet}
              onSelect={onSelectBet}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
            />
          </div>

          <div className="flex flex-col gap-2">
            <DesktopMarketCell
              game={game}
              market={spread}
              outcome={awaySpread}
              team={game.away_team}
              teamInfo={game.away_team_info}
              selectedBet={selectedBet}
              onSelect={onSelectBet}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
            />

            <DesktopMarketCell
              game={game}
              market={spread}
              outcome={homeSpread}
              team={game.home_team}
              teamInfo={game.home_team_info}
              selectedBet={selectedBet}
              onSelect={onSelectBet}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
            />
          </div>

          <div className="flex flex-col gap-2">
            <DesktopMarketCell
              game={game}
              market={total}
              outcome={overTotal}
              selectedBet={selectedBet}
              onSelect={onSelectBet}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
            />

            <DesktopMarketCell
              game={game}
              market={total}
              outcome={underTotal}
              selectedBet={selectedBet}
              onSelect={onSelectBet}
              now={now}
              colorsEnabled={colorsEnabled}
              goldEnabled={goldEnabled}
            />
          </div>
        </div>
      </article>
    </>
  );
}

function getFirstBetForGames(games: Game[] | undefined, now?: number | null) {
  const firstGame = games?.[0];
  if (!firstGame) return null;

  const bookmaker = firstGame.bookmakers[0];
  const h2h = getMarket(bookmaker, "h2h");
  const spread = getMarket(bookmaker, "spreads");
  const total = getMarket(bookmaker, "totals");
  const awayMoneyline = getOutcomeByName(h2h?.outcomes, firstGame.away_team);
  const awaySpread = getOutcomeByName(spread?.outcomes, firstGame.away_team);
  const overTotal = getOutcomeByOutcomeName(total?.outcomes, "Over");

  if (h2h && awayMoneyline) {
    return buildBetData({
      game: firstGame,
      market: h2h,
      outcome: awayMoneyline,
      teamInfo: firstGame.away_team_info,
      now,
    });
  }

  if (spread && awaySpread) {
    return buildBetData({
      game: firstGame,
      market: spread,
      outcome: awaySpread,
      teamInfo: firstGame.away_team_info,
      now,
    });
  }

  if (total && overTotal) {
    return buildBetData({
      game: firstGame,
      market: total,
      outcome: overTotal,
      now,
    });
  }

  return null;
}

function getFirstBetForLeague(
  league: LeagueBlock | undefined,
  now?: number | null,
) {
  return getFirstBetForGames(league?.games, now);
}

export default function GamesClient({
  data,
  league,
  leagues,
  selectedLeague,
  selectedLeagueMeta,
}: {
  data: ApiResponse;
  league?: LeagueBlock;
  leagues: readonly LeagueMeta[];
  selectedLeague: string;
  selectedLeagueMeta: LeagueMeta;
}) {
  const allGames = useMemo(() => league?.games ?? [], [league?.games]);
  const now = useCurrentTimestamp(true);
  const liveGameCount = useMemo(
    () =>
      now === null
        ? allGames.filter((game) => getGameIsLive(game)).length
        : allGames.filter((game) => getGameIsLive(game, now)).length,
    [allGames, now],
  );

  const [hideLiveGames, setHideLiveGames] = useState(false);
  const [hideLiveGamesLoaded, setHideLiveGamesLoaded] = useState(false);
  const [marketColorsEnabled, setMarketColorsEnabled] = useState(false);
  const [marketColorsLoaded, setMarketColorsLoaded] = useState(false);
  const [goldMarketsEnabled, setGoldMarketsEnabled] = useState(false);
  const [goldMarketsLoaded, setGoldMarketsLoaded] = useState(false);
  const [proMarketsEnabled, setProMarketsEnabled] = useState(true);
  const [proMarketsLoaded, setProMarketsLoaded] = useState(false);

  useBrowserLayoutEffect(() => {
    let storedGoldMarketsEnabled = readStoredGoldMarketsEnabled();
    let storedProMarketsEnabled = readStoredProMarketsEnabled();
    let storedMarketColorsEnabled = storedGoldMarketsEnabled
      ? false
      : readStoredMarketColorsEnabled();

    try {
      const defaultsApplied =
        window.localStorage.getItem(MARKET_DISPLAY_DEFAULTS_STORAGE_KEY) ===
        "true";

      if (!defaultsApplied) {
        storedProMarketsEnabled = true;
        storedMarketColorsEnabled = false;
        storedGoldMarketsEnabled = false;

        writeStoredProMarketsEnabled(true);
        writeStoredMarketColorsEnabled(false);
        writeStoredGoldMarketsEnabled(false);
        window.localStorage.setItem(MARKET_DISPLAY_DEFAULTS_STORAGE_KEY, "true");
      }
    } catch {
      // Fall back to the in-memory defaults when storage is unavailable.
    }

    setHideLiveGames(readStoredHideLiveGames());
    setMarketColorsEnabled(storedMarketColorsEnabled);
    setGoldMarketsEnabled(storedGoldMarketsEnabled);
    setProMarketsEnabled(storedProMarketsEnabled);
    setHideLiveGamesLoaded(true);
    setMarketColorsLoaded(true);
    setGoldMarketsLoaded(true);
    setProMarketsLoaded(true);

    if (storedGoldMarketsEnabled) {
      writeStoredMarketColorsEnabled(false);
    }
  }, []);

  const visibleGames = useMemo(() => {
    if (!hideLiveGamesLoaded) return [];
    if (!hideLiveGames) return allGames;

    return allGames.filter((game) =>
      now === null ? !getGameIsLive(game) : !getGameIsLive(game, now),
    );
  }, [allGames, hideLiveGames, hideLiveGamesLoaded, now]);

  const initialGameStateReady =
    hideLiveGamesLoaded &&
    marketColorsLoaded &&
    goldMarketsLoaded &&
    proMarketsLoaded &&
    now !== null;
  const totalGames = visibleGames.length;

  const visibleFirstBet = useMemo(
    () => getFirstBetForGames(visibleGames, now),
    [visibleGames, now],
  );

  const [selectedBet, setSelectedBet] =
    useState<BetSlipDataWithTeamAlias | null>(null);

  function toggleHideLiveGames() {
    setHideLiveGames((current) => {
      const nextValue = !current;
      writeStoredHideLiveGames(nextValue);
      return nextValue;
    });
  }

  function toggleProMarkets() {
    setProMarketsEnabled((current) => {
      const nextValue = !current;
      writeStoredProMarketsEnabled(nextValue);
      return nextValue;
    });
  }

  function toggleMarketColors() {
    setMarketColorsEnabled((current) => {
      const nextValue = !current;
      writeStoredMarketColorsEnabled(nextValue);

      if (nextValue) {
        setGoldMarketsEnabled(false);
        writeStoredGoldMarketsEnabled(false);
      }

      return nextValue;
    });
  }

  function toggleGoldMarkets() {
    setGoldMarketsEnabled((current) => {
      const nextValue = !current;
      writeStoredGoldMarketsEnabled(nextValue);

      if (nextValue) {
        setMarketColorsEnabled(false);
        writeStoredMarketColorsEnabled(false);
      }

      return nextValue;
    });
  }

  function renderMarketControls() {
    const showHideLiveToggle = hideLiveGamesLoaded && liveGameCount > 0;

    return (
      <div className="inline-flex h-[29px] items-center gap-1.5">
        <MarketSettingsDropdown
          proEnabled={proMarketsEnabled}
          colorsEnabled={marketColorsEnabled}
          goldEnabled={goldMarketsEnabled}
          onTogglePro={toggleProMarkets}
          onToggleColors={toggleMarketColors}
          onToggleGold={toggleGoldMarkets}
        />

        {showHideLiveToggle ? (
          <HideLiveToggle
            enabled={hideLiveGames}
            onToggle={toggleHideLiveGames}
          />
        ) : null}
      </div>
    );
  }

  const groupedGames = useMemo(() => {
    const groups: {
      key: string;
      date: string;
      games: Game[];
    }[] = [];

    for (const game of visibleGames) {
      const key = getGameDateKey(game.commence_time);
      const existingGroup = groups.find((group) => group.key === key);

      if (existingGroup) {
        existingGroup.games.push(game);
      } else {
        groups.push({
          key,
          date: formatGameDate(game.commence_time),
          games: [game],
        });
      }
    }

    return groups;
  }, [visibleGames]);

  useEffect(() => {
    if (!hideLiveGamesLoaded) return;

    setSelectedBet((current) => {
      if (!current) return visibleFirstBet;

      const selectedGame = visibleGames.find(
        (game) => game.id === current.gameId,
      );

      if (!selectedGame) {
        return visibleFirstBet;
      }

      const isLive =
        now === null
          ? getGameIsLive(selectedGame)
          : getGameIsLive(selectedGame, now);

      if (Boolean(current.isLive) === isLive) {
        return current;
      }

      return {
        ...current,
        isLive,
      };
    });
  }, [hideLiveGamesLoaded, now, visibleFirstBet, visibleGames]);

  if (!initialGameStateReady) {
    return <div className="min-h-screen bg-[#09090b]" aria-hidden="true" />;
  }

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white">
      <div className="relative mx-auto w-full max-w-[1660px] px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:pb-6">
        <header className="overflow-visible pt-[calc(60px+env(safe-area-inset-top))] lg:pt-2 xl:pr-[420px]">
          <div className="relative left-1/2 w-[100dvw] -translate-x-1/2 overflow-visible sm:left-auto sm:w-auto sm:translate-x-0">
            <LeagueTabs leagues={leagues} selectedLeague={selectedLeague} />
          </div>
        </header>

        <div className="mt-5 grid gap-6 lg:mt-[26px] xl:grid-cols-[minmax(0,1156px)_420px] xl:items-start xl:justify-center">
          <main className="min-w-0">
            <section className="lg:space-y-4">
              <div className="hidden grid-cols-[148px_minmax(0,1fr)_148px] items-end gap-3 lg:grid">
                <LastUpdatedAgo updatedAt={data.updatedAt} />

                <div className="hidden min-w-0 text-center sm:block">
                  <h2 className="text-[33px] font-semibold leading-none tracking-tight text-zinc-50">
                    {league?.leagueLabel ?? selectedLeagueMeta.label}
                  </h2>

                  <p className="mt-0.5 text-[12px] leading-none text-zinc-400">
                    {hideLiveGamesLoaded
                      ? `${totalGames} game${totalGames === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>

                <div className="hidden w-[148px] items-end justify-end lg:flex">
                  {league?.error ? (
                    <div className="rounded-full border border-red-900/60 bg-red-950/60 px-3 py-1 text-[11px] font-medium text-red-400">
                      {league.error}
                    </div>
                  ) : (
                    renderMarketControls()
                  )}
                </div>
              </div>

              {!league || league.games.length === 0 ? (
                <div className="text-[13px] text-zinc-400">
                  No active {selectedLeagueMeta.label} markets right now
                </div>
              ) : visibleGames.length === 0 ? (
                <div className="flex items-center justify-between gap-3 text-[13px] text-zinc-400">
                  <span>
                    No non-live {selectedLeagueMeta.label} markets right now
                  </span>
                  <span className="lg:hidden">{renderMarketControls()}</span>
                </div>
              ) : (
                <div className="grid gap-7">
                  {groupedGames.map((group, groupIndex) => (
                    <div key={group.key} className="grid gap-3 lg:gap-2">
                      <DateMarketHeader
                        date={group.date}
                        games={group.games}
                        action={
                          groupIndex === 0 ? renderMarketControls() : null
                        }
                        now={now}
                        showMarketLabels={groupIndex === 0}
                      />

                      <div className="grid gap-2.5 md:gap-3">
                        {group.games.map((game, index) => {
                          const isLastVisibleGame =
                            groupIndex === groupedGames.length - 1 &&
                            index === group.games.length - 1;

                          return (
                            <div key={game.id} className={index > 0 ? "" : ""}>
                              <GameCard
                                game={game}
                                selectedBet={selectedBet}
                                onSelectBet={setSelectedBet}
                                shouldAutoScrollOnMoreBetsOpen={
                                  isLastVisibleGame && totalGames >= 2
                                }
                                now={now}
                                colorsEnabled={marketColorsEnabled}
                                goldEnabled={goldMarketsEnabled}
                                proEnabled={proMarketsEnabled}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  team={selectedBet.team}
                  teamAlias={selectedBet.teamAlias}
                  gameId={selectedBet.gameId}
                  league={selectedBet.league}
                  market={selectedBet.market}
                  odds={selectedBet.odds}
                  impliedPercent={selectedBet.impliedPercent}
                  matchup={selectedBet.matchup}
                  matchupAlias={selectedBet.matchupAlias}
                  isLive={selectedBet.isLive}
                  polymarketEventId={selectedBet.polymarketEventId}
                  polymarketEventSlug={selectedBet.polymarketEventSlug}
                  polymarketMarketId={selectedBet.polymarketMarketId}
                  polymarketConditionId={selectedBet.polymarketConditionId}
                  polymarketMarketSlug={selectedBet.polymarketMarketSlug}
                  polymarketOutcome={selectedBet.polymarketOutcome}
                  polymarketOutcomeIndex={selectedBet.polymarketOutcomeIndex}
                  polymarketTokenId={selectedBet.polymarketTokenId}
                  teamLogo={selectedBet.teamLogo}
                  teamLogoAlt={selectedBet.teamLogoAlt}
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
      </div>
    </div>
  );
}