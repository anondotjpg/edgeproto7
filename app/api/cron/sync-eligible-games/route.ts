import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  fetchEligibleLeagueGames,
  flattenLeagueGames,
  LEAGUES,
  type EventOdds,
} from "@/lib/eligible-games";

export const dynamic = "force-dynamic";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const UPSERT_CHUNK_SIZE = 100;

type EligibleGameRow = {
  id: string;
  slug: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  is_live: boolean;
  status: "open" | "live";
  away_team: string;
  home_team: string;
  away_team_info: EventOdds["away_team_info"] | null;
  home_team_info: EventOdds["home_team_info"] | null;
  bookmakers: EventOdds["bookmakers"];
  polymarket: NonNullable<EventOdds["polymarket"]> | Record<string, never>;
  outcome_token_ids: EventOdds["outcome_token_ids"] | null;
  debug: EventOdds["debug"] | null;
  last_seen_at: string;
};

function requireCronSecret(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Missing CRON_SECRET env var." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function gameToRow(game: EventOdds, lastSeenAt: string): EligibleGameRow {
  return {
    id: game.id,
    slug: game.slug,
    sport_key: game.sport_key,
    sport_title: game.sport_title,
    commence_time: game.commence_time,
    is_live: game.isLive,
    status: game.isLive ? "live" : "open",
    away_team: game.away_team,
    home_team: game.home_team,
    away_team_info: game.away_team_info ?? null,
    home_team_info: game.home_team_info ?? null,
    bookmakers: game.bookmakers,
    polymarket: game.polymarket ?? {},
    outcome_token_ids: game.outcome_token_ids ?? null,
    debug: game.debug ?? null,
    last_seen_at: lastSeenAt,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const syncStartedAt = new Date().toISOString();
  const oldGameCutoff = new Date(
    Date.now() - TWENTY_FOUR_HOURS_MS,
  ).toISOString();

  const leagueResults = await fetchEligibleLeagueGames();
  const successfulLeagueKeys = leagueResults
    .filter((league) => !league.error)
    .map((league) => league.leagueKey);

  const games = flattenLeagueGames(leagueResults);
  const rows = games.map((game) => gameToRow(game, syncStartedAt));

  for (const rowsChunk of chunk(rows, UPSERT_CHUNK_SIZE)) {
    const { error } = await supabaseAdmin
      .from("eligible_games")
      .upsert(rowsChunk, { onConflict: "id" });

    if (error) {
      console.error("Eligible games upsert error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to sync eligible games." },
        { status: 500 },
      );
    }
  }

  let deletedClosedOrMissing = 0;
  let deletedOld = 0;

  if (successfulLeagueKeys.length) {
    const { data, error } = await supabaseAdmin
      .from("eligible_games")
      .delete()
      .in("sport_key", successfulLeagueKeys)
      .lt("last_seen_at", syncStartedAt)
      .select("id");

    if (error) {
      console.error("Eligible games stale delete error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to clear closed games." },
        { status: 500 },
      );
    }

    deletedClosedOrMissing = data?.length ?? 0;
  }

  const { data: oldRows, error: oldDeleteError } = await supabaseAdmin
    .from("eligible_games")
    .delete()
    .lt("commence_time", oldGameCutoff)
    .select("id");

  if (oldDeleteError) {
    console.error("Eligible games old delete error:", oldDeleteError);
    return NextResponse.json(
      { error: oldDeleteError.message || "Failed to clear old games." },
      { status: 500 },
    );
  }

  deletedOld = oldRows?.length ?? 0;

  return NextResponse.json({
    ok: true,
    syncedAt: syncStartedAt,
    saved: rows.length,
    deletedClosedOrMissing,
    deletedOld,
    leagues: leagueResults.map((league) => ({
      leagueKey: league.leagueKey,
      saved: league.games.length,
      error: league.error,
    })),
    configuredLeagues: LEAGUES.map((league) => league.key),
  });
}

export async function GET(request: Request) {
  return POST(request);
}