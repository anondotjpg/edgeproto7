import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { privyServer } from "@/lib/privy-server";

const MIN_ALLOWED_AMERICAN_ODDS = -190;
const ALLOWED_MARKETS = new Set(["h2h", "spreads", "totals"]);

const DUPLICATE_OPEN_BET_INDEX = "bets_one_open_polymarket_pick_per_account_idx";
const DUPLICATE_OPEN_BET_OUTCOME_INDEX =
  "bets_one_open_polymarket_outcome_per_account";
const LEGACY_DUPLICATE_OPEN_BET_INDEX =
  "bets_unique_open_account_condition_token";

type PlaceBetBody = {
  accountIds?: string[];
  gameId?: string;
  league?: string;
  market?: string;
  selection?: string;
  odds?: number;
  stake?: number;

  polymarketEventId?: string | null;
  polymarketEventSlug?: string | null;
  polymarketMarketId?: string | null;
  polymarketConditionId?: string | null;
  polymarketMarketSlug?: string | null;
  polymarketOutcome?: string | null;
  polymarketOutcomeIndex?: number | null;
  polymarketTokenId?: string | null;
  teamLogo?: string | null;
  teamLogoAlt?: string | null;
};

type EligibleGameRow = {
  id: string;
  sport_key: string;
  commence_time: string;
  is_live: boolean;
  status: string;
  away_team: string;
  home_team: string;
  away_team_info: unknown | null;
  home_team_info: unknown | null;
  bookmakers: unknown;
  polymarket: unknown;
  outcome_token_ids: unknown | null;
};

type ServerBetDetails = {
  selection: string;
  odds: number;
  outcomeIndex: number;
  polymarketOutcome: string;
  polymarketTokenId: string;
  polymarketEventId: string | null;
  polymarketEventSlug: string | null;
  polymarketMarketId: string | null;
  polymarketConditionId: string | null;
  polymarketMarketSlug: string | null;
  teamLogo: string | null;
  teamLogoAlt: string | null;
};

type RpcLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return null;

  return parsed;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getRecordText(record: Record<string, unknown> | null, key: string) {
  return record ? cleanText(record[key]) : null;
}

function getRecordNumber(record: Record<string, unknown> | null, key: string) {
  return record ? cleanNumber(record[key]) : null;
}

function getTeamInfoValue(teamInfo: unknown, key: string) {
  return getRecordText(asRecord(teamInfo), key);
}

function formatPoint(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function getOutcomeTokenId({
  outcome,
  marketPolymarket,
  index,
}: {
  outcome: Record<string, unknown> | null;
  marketPolymarket: Record<string, unknown> | null;
  index: number;
}) {
  const directTokenId = getRecordText(outcome, "tokenId");
  if (directTokenId) return directTokenId;

  const clobTokenIds = asArray(marketPolymarket?.clob_token_ids);
  const tokenFromMarket = clobTokenIds[index];

  return cleanText(tokenFromMarket);
}

function getMarketPolymarket({
  game,
  marketRecord,
}: {
  game: EligibleGameRow;
  marketRecord: Record<string, unknown> | null;
}) {
  return asRecord(marketRecord?.polymarket) ?? asRecord(game.polymarket);
}

function getTeamLogoForOutcome(game: EligibleGameRow, outcomeName: string) {
  const outcome = outcomeName.trim();

  if (outcome === game.away_team) {
    return {
      teamLogo: getTeamInfoValue(game.away_team_info, "logo"),
      teamLogoAlt: getTeamInfoValue(game.away_team_info, "name") ?? game.away_team,
    };
  }

  if (outcome === game.home_team) {
    return {
      teamLogo: getTeamInfoValue(game.home_team_info, "logo"),
      teamLogoAlt: getTeamInfoValue(game.home_team_info, "name") ?? game.home_team,
    };
  }

  return {
    teamLogo: null,
    teamLogoAlt: outcome,
  };
}

function getSelectionLabel({
  marketKey,
  marketRecord,
  outcome,
  outcomeName,
}: {
  marketKey: string;
  marketRecord: Record<string, unknown> | null;
  outcome: Record<string, unknown> | null;
  outcomeName: string;
}) {
  const line = getRecordNumber(marketRecord, "line");
  const point = getRecordNumber(outcome, "point");

  if (marketKey === "spreads") {
    return `${outcomeName} ${formatPoint(point ?? line)}`.trim();
  }

  if (marketKey === "totals") {
    return `${outcomeName} ${line ?? point ?? ""}`.trim();
  }

  return outcomeName;
}

function getServerBetDetails({
  game,
  requestMarket,
  requestPolymarketConditionId,
  requestPolymarketTokenId,
}: {
  game: EligibleGameRow;
  requestMarket: string;
  requestPolymarketConditionId: string;
  requestPolymarketTokenId: string;
}): ServerBetDetails | null {
  const bookmakers = asArray(game.bookmakers);
  const bookmaker = bookmakers.find((item) => asRecord(item)?.markets);
  const markets = asArray(asRecord(bookmaker)?.markets);
  const matchingMarkets = markets
    .map(asRecord)
    .filter((market): market is Record<string, unknown> => {
      return getRecordText(market, "key") === requestMarket;
    });

  for (const marketRecord of matchingMarkets) {
    const marketPolymarket = getMarketPolymarket({ game, marketRecord });
    const serverConditionId = getRecordText(marketPolymarket, "condition_id");

    if (
      serverConditionId &&
      serverConditionId !== requestPolymarketConditionId
    ) {
      continue;
    }

    const outcomes = asArray(marketRecord.outcomes);

    for (let index = 0; index < outcomes.length; index += 1) {
      const outcome = asRecord(outcomes[index]);
      const tokenId = getOutcomeTokenId({
        outcome,
        marketPolymarket,
        index,
      });

      if (tokenId !== requestPolymarketTokenId) continue;

      const odds = Number(outcome?.price);

      if (!Number.isFinite(odds) || odds === 0) return null;

      const outcomeName =
        getRecordText(outcome, "name") ??
        getRecordText(outcome, "polymarketOutcome") ??
        "Selection";

      const polymarketOutcome =
        getRecordText(outcome, "polymarketOutcome") ?? outcomeName;
      const polymarketOutcomeIndex =
        cleanInteger(outcome?.polymarketOutcomeIndex) ?? index;
      const teamLogoData = getTeamLogoForOutcome(game, outcomeName);

      return {
        selection: getSelectionLabel({
          marketKey: requestMarket,
          marketRecord,
          outcome,
          outcomeName,
        }),
        odds,
        outcomeIndex: polymarketOutcomeIndex,
        polymarketOutcome,
        polymarketTokenId: tokenId,
        polymarketEventId: getRecordText(marketPolymarket, "event_id"),
        polymarketEventSlug: getRecordText(marketPolymarket, "event_slug"),
        polymarketMarketId: getRecordText(marketPolymarket, "market_id"),
        polymarketConditionId: serverConditionId,
        polymarketMarketSlug: getRecordText(marketPolymarket, "market_slug"),
        teamLogo: teamLogoData.teamLogo,
        teamLogoAlt: teamLogoData.teamLogoAlt,
      };
    }
  }

  return null;
}

function blockBet(message: string, reason: string) {
  return NextResponse.json({
    ok: false,
    blocked: true,
    reason,
    message,
    error: message,
  });
}

function getErrorText(error: RpcLikeError | string | null | undefined) {
  if (typeof error === "string") return error;

  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ");
}

function isDuplicateBetError(error: RpcLikeError | string | null | undefined) {
  const errorText = getErrorText(error);
  const lowerErrorText = errorText.toLowerCase();
  const code = typeof error === "string" ? null : error?.code;

  return (
    code === "23505" ||
    lowerErrorText.includes("duplicate key") ||
    lowerErrorText.includes("duplicate") ||
    errorText.includes(DUPLICATE_OPEN_BET_INDEX) ||
    errorText.includes(DUPLICATE_OPEN_BET_OUTCOME_INDEX) ||
    errorText.includes(LEGACY_DUPLICATE_OPEN_BET_INDEX)
  );
}

function cleanRpcError(error: RpcLikeError | string) {
  const message = getErrorText(error);

  if (message.includes("Max risk per bet exceeded")) {
    return message;
  }

  if (message.includes("Insufficient balance")) {
    return "Insufficient available balance.";
  }

  if (message.includes("Account not active")) {
    return "This account is not active.";
  }

  if (message.includes("Account not found")) {
    return "Account not found.";
  }

  if (message.includes("Invalid stake")) {
    return "Invalid stake.";
  }

  if (message.includes("Invalid odds")) {
    return "Invalid odds.";
  }

  if (isDuplicateBetError(error)) {
    return "You already placed this bet on this account.";
  }

  return message || "Unable to place bet.";
}

export async function POST(req: Request) {
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verifiedClaims = await privyServer
      .utils()
      .auth()
      .verifyAuthToken(accessToken);

    const privyUserId = verifiedClaims.user_id;

    if (!privyUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as PlaceBetBody;

    const accountIds = body.accountIds ?? [];
    const gameId = cleanText(body.gameId);
    const requestLeague = cleanText(body.league);
    const requestMarket = cleanText(body.market) ?? "h2h";
    const stake = Number(body.stake);

    const requestPolymarketConditionId = cleanText(body.polymarketConditionId);
    const requestPolymarketTokenId = cleanText(body.polymarketTokenId);
    const requestTeamLogo = cleanText(body.teamLogo);
    const requestTeamLogoAlt = cleanText(body.teamLogoAlt);

    if (!accountIds.length) {
      return blockBet("Select at least one account.", "missing_account");
    }

    if (!gameId || !requestLeague || !requestMarket) {
      return blockBet("Missing bet details.", "missing_bet_details");
    }

    if (!ALLOWED_MARKETS.has(requestMarket)) {
      return blockBet("This market is not available.", "market_not_allowed");
    }

    if (!Number.isFinite(stake) || stake <= 0) {
      return blockBet("Invalid stake.", "invalid_stake");
    }

    if (!requestPolymarketConditionId || !requestPolymarketTokenId) {
      return blockBet(
        "Missing Polymarket settlement data. Refresh the market and try again.",
        "missing_settlement_data",
      );
    }

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError) throw userError;

    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const cleanAccountIds = Array.from(
      new Set(
        accountIds.map(cleanText).filter((id): id is string => Boolean(id)),
      ),
    );

    if (!cleanAccountIds.length) {
      return blockBet("Invalid account ID.", "invalid_account");
    }

    const { data: eligibleGame, error: eligibleGameError } = await supabaseAdmin
      .from("eligible_games")
      .select(
        "id, sport_key, commence_time, is_live, status, away_team, home_team, away_team_info, home_team_info, bookmakers, polymarket, outcome_token_ids",
      )
      .eq("id", gameId)
      .maybeSingle();

    if (eligibleGameError) throw eligibleGameError;

    if (
      !eligibleGame ||
      !["open", "live"].includes(String(eligibleGame.status))
    ) {
      return blockBet("This game is no longer available.", "game_unavailable");
    }

    const game = eligibleGame as EligibleGameRow;

    if (game.sport_key !== requestLeague) {
      return blockBet("This market changed. Refresh and try again.", "league_changed");
    }

    const gameHasStarted =
      Boolean(game.is_live) ||
      Date.parse(String(game.commence_time)) <= Date.now();

    if (gameHasStarted) {
      return blockBet("Game Started", "game_started");
    }

    const serverBet = getServerBetDetails({
      game,
      requestMarket,
      requestPolymarketConditionId,
      requestPolymarketTokenId,
    });

    if (!serverBet) {
      return blockBet(
        "This outcome is no longer available. Refresh and try again.",
        "outcome_unavailable",
      );
    }

    if (
      serverBet.polymarketConditionId &&
      serverBet.polymarketConditionId !== requestPolymarketConditionId
    ) {
      return blockBet(
        "This market changed. Refresh and try again.",
        "market_changed",
      );
    }

    if (serverBet.odds < MIN_ALLOWED_AMERICAN_ODDS) {
      return blockBet(
        "Only -190 or better odds can be placed.",
        "odds_not_allowed",
      );
    }

    const finalConditionId =
      serverBet.polymarketConditionId ?? requestPolymarketConditionId;

    const { data: duplicateBets, error: duplicateBetError } =
      await supabaseAdmin
        .from("bets")
        .select("id, account_id")
        .eq("user_id", dbUser.id)
        .in("account_id", cleanAccountIds)
        .eq("polymarket_condition_id", finalConditionId)
        .eq("polymarket_token_id", serverBet.polymarketTokenId)
        .eq("status", "open")
        .limit(1);

    if (duplicateBetError) throw duplicateBetError;

    if (duplicateBets?.length) {
      return blockBet(
        "You already placed this bet on this account.",
        "duplicate_open_bet",
      );
    }

    const placedBetIds: string[] = [];

    for (const cleanAccountId of cleanAccountIds) {
      const { data: betId, error: rpcError } = await supabaseAdmin.rpc(
        "place_bet_for_account",
        {
          p_user_id: dbUser.id,
          p_account_id: cleanAccountId,
          p_game_id: game.id,
          p_league: game.sport_key,
          p_market: requestMarket,
          p_selection: serverBet.selection,
          p_odds: serverBet.odds,
          p_stake: stake,

          p_polymarket_event_id: serverBet.polymarketEventId,
          p_polymarket_event_slug: serverBet.polymarketEventSlug,
          p_polymarket_market_id: serverBet.polymarketMarketId,
          p_polymarket_condition_id: finalConditionId,
          p_polymarket_market_slug: serverBet.polymarketMarketSlug,
          p_polymarket_outcome: serverBet.polymarketOutcome,
          p_polymarket_outcome_index: serverBet.outcomeIndex,
          p_polymarket_token_id: serverBet.polymarketTokenId,
          p_team_logo: serverBet.teamLogo ?? requestTeamLogo,
          p_team_logo_alt: serverBet.teamLogoAlt ?? requestTeamLogoAlt,
        },
      );

      if (rpcError) {
        const cleanedMessage = cleanRpcError(rpcError);

        if (isDuplicateBetError(rpcError)) {
          return blockBet(cleanedMessage, "duplicate_open_bet");
        }

        return NextResponse.json(
          {
            error: cleanedMessage,
            details: rpcError.message,
          },
          { status: 400 },
        );
      }

      placedBetIds.push(betId as string);
    }

    return NextResponse.json({
      ok: true,
      betIds: placedBetIds,
      market: requestMarket,
      odds: serverBet.odds,
      selection: serverBet.selection,
      polymarketConditionId: finalConditionId,
      polymarketTokenId: serverBet.polymarketTokenId,
    });
  } catch (error) {
    console.error("Place bet error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to place bet.",
      },
      { status: 500 },
    );
  }
}