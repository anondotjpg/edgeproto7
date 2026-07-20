import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const LEAGUES = [
  { key: "nba", label: "NBA" },
  { key: "nhl", label: "NHL" },
  { key: "mlb", label: "MLB" },
  { key: "wnba", label: "WNBA" },
  { key: "nfl", label: "NFL" },
  { key: "cfb", label: "CFB" },
] as const;

const POLYMARKET_TEAMS_URL =
  "https://gateway.polymarket.us/v1/sports/teams";

const TEAM_COLOR_CACHE_MS = 15 * 60 * 1000;

type EligibleGameRow = {
  id: string;
  slug: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  is_live: boolean;
  away_team: string;
  home_team: string;
  away_team_info: unknown | null;
  home_team_info: unknown | null;
  bookmakers: unknown;
  polymarket: unknown;
  outcome_token_ids: unknown | null;
  debug?: unknown | null;
};

type PolymarketTeam = {
  name?: string | null;
  league?: string | null;
  logo?: string | null;
  abbreviation?: string | null;
  alias?: string | null;
  color?: string | null;
  displayAbbreviation?: string | null;
  safeName?: string | null;
};

type TeamInfo = {
  name?: string;
  abbreviation?: string;
  alias?: string;
  record?: string;
  logo?: string;
  color?: string;
};

let cachedTeamsByKey: Map<string, PolymarketTeam> | null = null;
let cachedTeamsAt = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeLeague(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (normalized.includes("basketball") && normalized.includes("women")) {
    return "wnba";
  }

  if (normalized.includes("nba")) return "nba";
  if (normalized.includes("wnba")) return "wnba";
  if (normalized.includes("nhl")) return "nhl";
  if (normalized.includes("mlb")) return "mlb";

  return normalized;
}

function isValidHexColor(value: string | null | undefined) {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value ?? ""));
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTeamInfo(value: unknown): TeamInfo | undefined {
  if (!isRecord(value)) return undefined;

  const teamInfo: TeamInfo = {
    name: getString(value.name),
    abbreviation: getString(value.abbreviation),
    alias: getString(value.alias),
    record: getString(value.record),
    logo: getString(value.logo),
    color: getString(value.color),
  };

  return teamInfo;
}

function addTeamKey(
  map: Map<string, PolymarketTeam>,
  league: string,
  value: string | null | undefined,
  team: PolymarketTeam,
) {
  const normalizedValue = normalizeText(value);
  const compactValue = compactText(value);

  if (normalizedValue) {
    map.set(`${league}:${normalizedValue}`, team);
  }

  if (compactValue) {
    map.set(`${league}:${compactValue}`, team);
  }
}

function buildTeamsByKey(teams: PolymarketTeam[]) {
  const map = new Map<string, PolymarketTeam>();

  teams.forEach((team) => {
    const league = normalizeLeague(team.league);

    if (!league) return;

    addTeamKey(map, league, team.name, team);
    addTeamKey(map, league, team.safeName, team);
    addTeamKey(map, league, team.alias, team);
    addTeamKey(map, league, team.abbreviation, team);
    addTeamKey(map, league, team.displayAbbreviation, team);
  });

  return map;
}

async function getPolymarketTeamsByKey() {
  const now = Date.now();

  if (cachedTeamsByKey && now - cachedTeamsAt < TEAM_COLOR_CACHE_MS) {
    return cachedTeamsByKey;
  }

  try {
    const response = await fetch(`${POLYMARKET_TEAMS_URL}?limit=1000`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Polymarket teams request failed: ${response.status}`);
    }

    const data = await response.json();
    const teams = Array.isArray(data?.teams) ? data.teams : [];

    cachedTeamsByKey = buildTeamsByKey(teams as PolymarketTeam[]);
    cachedTeamsAt = now;

    return cachedTeamsByKey;
  } catch (error) {
    console.error(error);

    cachedTeamsByKey = cachedTeamsByKey ?? new Map();
    cachedTeamsAt = now;

    return cachedTeamsByKey;
  }
}

function findPolymarketTeam({
  teamsByKey,
  league,
  teamName,
  teamInfo,
}: {
  teamsByKey: Map<string, PolymarketTeam>;
  league: string;
  teamName: string;
  teamInfo?: TeamInfo;
}) {
  const normalizedLeague = normalizeLeague(league);

  const candidates = [
    teamInfo?.name,
    teamInfo?.alias,
    teamInfo?.abbreviation,
    teamName,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    const compact = compactText(candidate);

    const exactMatch =
      teamsByKey.get(`${normalizedLeague}:${normalized}`) ??
      teamsByKey.get(`${normalizedLeague}:${compact}`);

    if (exactMatch) return exactMatch;
  }

  return null;
}

function mergeTeamInfo({
  teamsByKey,
  league,
  teamName,
  rawTeamInfo,
}: {
  teamsByKey: Map<string, PolymarketTeam>;
  league: string;
  teamName: string;
  rawTeamInfo: unknown | null;
}) {
  const existingTeamInfo = normalizeTeamInfo(rawTeamInfo);
  const polymarketTeam = findPolymarketTeam({
    teamsByKey,
    league,
    teamName,
    teamInfo: existingTeamInfo,
  });

  const color =
    existingTeamInfo?.color && isValidHexColor(existingTeamInfo.color)
      ? existingTeamInfo.color
      : isValidHexColor(polymarketTeam?.color)
        ? polymarketTeam?.color ?? undefined
        : undefined;

  return {
    name: existingTeamInfo?.name ?? polymarketTeam?.name ?? teamName,
    abbreviation:
      existingTeamInfo?.abbreviation ??
      polymarketTeam?.displayAbbreviation ??
      polymarketTeam?.abbreviation ??
      undefined,
    alias: existingTeamInfo?.alias ?? polymarketTeam?.alias ?? undefined,
    record: existingTeamInfo?.record,
    logo: existingTeamInfo?.logo ?? polymarketTeam?.logo ?? undefined,
    color,
  };
}

function rowToGame(row: EligibleGameRow, teamsByKey: Map<string, PolymarketTeam>) {
  return {
    id: row.id,
    slug: row.slug,
    sport_key: row.sport_key,
    sport_title: row.sport_title,
    commence_time: row.commence_time,
    isLive: Boolean(row.is_live) || Date.parse(row.commence_time) <= Date.now(),
    away_team: row.away_team,
    home_team: row.home_team,
    away_team_info: mergeTeamInfo({
      teamsByKey,
      league: row.sport_key,
      teamName: row.away_team,
      rawTeamInfo: row.away_team_info,
    }),
    home_team_info: mergeTeamInfo({
      teamsByKey,
      league: row.sport_key,
      teamName: row.home_team,
      rawTeamInfo: row.home_team_info,
    }),
    bookmakers: Array.isArray(row.bookmakers) ? row.bookmakers : [],
    polymarket: row.polymarket ?? undefined,
    outcome_token_ids: row.outcome_token_ids ?? undefined,
    debug: row.debug ?? undefined,
  };
}

export async function GET() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, teamsByKey] = await Promise.all([
    supabaseAdmin
      .from("eligible_games")
      .select(
        "id, slug, sport_key, sport_title, commence_time, is_live, away_team, home_team, away_team_info, home_team_info, bookmakers, polymarket, outcome_token_ids, debug",
      )
      .gte("commence_time", cutoff)
      .order("commence_time", { ascending: true }),
    getPolymarketTeamsByKey(),
  ]);

  if (error) {
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        leagues: [],
        error: error.message,
      },
      { status: 500 },
    );
  }

  const games = (data ?? []).map((row) =>
    rowToGame(row as EligibleGameRow, teamsByKey),
  );

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    leagues: LEAGUES.map((league) => ({
      leagueKey: league.key,
      leagueLabel: league.label,
      games: games.filter((game) => game.sport_key === league.key),
    })),
  });
}