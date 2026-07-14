export const LEAGUES = [
  { key: "nba", label: "NBA", tag: 745, teamLeague: "nba" },
  { key: "nhl", label: "NHL", tag: 899, teamLeague: "nhl" },
  { key: "mlb", label: "MLB", tag: 100381, teamLeague: "mlb" },
  { key: "wnba", label: "WNBA", tag: 100254, teamLeague: "wnba" },
  { key: "nfl", label: "NFL", tag: 450, teamLeague: "nfl" },
] as const;

const MIN_MARKET_VOLUME = 200;

export type LeagueKey = (typeof LEAGUES)[number]["key"];
export type MarketKey = "h2h" | "spreads" | "totals";

export type OddsOutcome = {
  name: string;
  price: number;
  point?: number;
  tokenId?: string;
  polymarketOutcome?: string;
  polymarketOutcomeIndex?: number;
};

export type OddsMarket = {
  key: MarketKey;
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
    sports_market_type: string | null;
    volume: number | null;
    volume_24hr: number | null;
    liquidity: number | null;
  };
};

export type Bookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
};

export type TeamInfo = {
  name: string;
  abbreviation?: string;
  alias?: string;
  record?: string;
  logo?: string;
  color?: string;
  league?: string;
};

export type GameDebug = {
  eventSlug?: string;
  marketSlug?: string;
  eventTitle?: string;
  question?: string;
  outcomes?: string[];
  clobTokenIds?: string[];
  awaySlugTokens?: string[];
  homeSlugTokens?: string[];
  awayMatchedBy?: string;
  homeMatchedBy?: string;
  addedMarkets?: string[];
};

export type EventOdds = {
  id: string;
  slug: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  isLive: boolean;
  home_team: string;
  away_team: string;
  home_team_info?: TeamInfo;
  away_team_info?: TeamInfo;
  bookmakers: Bookmaker[];

  polymarket?: {
    event_id: string;
    event_slug: string | null;
    market_id: string;
    market_slug: string | null;
    condition_id: string | null;
    question: string | null;
    outcomes: string[];
    clob_token_ids: string[];
    volume: number | null;
    volume_24hr: number | null;
    liquidity: number | null;
  };

  outcome_token_ids?: {
    away?: string;
    home?: string;
  };

  debug?: GameDebug;
};

export type LeagueResponse = {
  leagueKey: string;
  leagueLabel: string;
  games: EventOdds[];
  error?: string;
};

type PolymarketMarket = {
  id: string | number;
  slug?: string;
  question?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
  conditionId?: string;
  condition_id?: string;
  volume?: string | number | null;
  volumeNum?: string | number | null;
  volumeClob?: string | number | null;
  volume24hr?: string | number | null;
  volume24hrClob?: string | number | null;
  liquidity?: string | number | null;
  liquidityNum?: string | number | null;
  liquidityClob?: string | number | null;
  gameStartTime?: string;
  endDate?: string;
  acceptingOrders?: boolean;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  sportsMarketType?: string | null;
  line?: string | number | null;
  groupItemTitle?: string | null;
};

type PolymarketEvent = {
  id: string | number;
  slug?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  markets?: PolymarketMarket[];
};

type PolymarketTeam = {
  id: number;
  name: string | null;
  league: string | null;
  record: string | null;
  logo: string | null;
  color?: string | null;
  abbreviation: string | null;
  alias: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const teamCache = new Map<string, PolymarketTeam | null>();

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
  }

  return [];
}

function parseNumericValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;

    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
}

function probabilityToAmerican(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return 0;
  }

  if (probability === 0.5) return 100;

  if (probability < 0.5) {
    return Math.round(((1 - probability) / probability) * 100);
  }

  return -Math.round((probability / (1 - probability)) * 100);
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function parseTeams(text: string): { away: string; home: string } | null {
  const cleaned = cleanText(text);
  const separators = [" vs. ", " vs ", " @ ", " at "];

  for (const separator of separators) {
    if (!cleaned.includes(separator)) continue;

    const parts = cleaned.split(separator).map(cleanText);

    if (parts.length !== 2) continue;
    if (!parts[0] || !parts[1]) continue;

    return {
      away: parts[0],
      home: parts[1],
    };
  }

  return null;
}

function getCommenceTime(
  event: PolymarketEvent,
  market: PolymarketMarket,
): string {
  return (
    market.gameStartTime ||
    event.startDate ||
    market.endDate ||
    event.endDate ||
    new Date().toISOString()
  );
}

function isWithinEligibleGameWindowFromNowUtc(dateString: string): boolean {
  const timestamp = Date.parse(dateString);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const nowUtcMs = Date.now();
  const lookbackMs = 24 * 60 * 60 * 1000;
  const lookaheadMs = 10 * 24 * 60 * 60 * 1000;

  return timestamp >= nowUtcMs - lookbackMs && timestamp <= nowUtcMs + lookaheadMs;
}

function hasGameStarted(dateString: string): boolean {
  const timestamp = Date.parse(dateString);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return timestamp <= Date.now();
}

function extractSlugTokens(
  slug: string | undefined,
  leagueKey: LeagueKey,
): string[] {
  if (!slug) return [];

  const parts = normalizeSlug(slug).split("-").filter(Boolean);
  if (parts.length === 0) return [];

  const withoutLeague = parts[0] === leagueKey ? parts.slice(1) : parts;

  return withoutLeague.filter((part) => !/^\d{1,4}$/.test(part));
}

function makeTeamInfo(team: PolymarketTeam): TeamInfo {
  return {
    name: team.name || team.alias || team.abbreviation || "Unknown Team",
    abbreviation: team.abbreviation || undefined,
    alias: team.alias || undefined,
    record: team.record || undefined,
    logo: team.logo || undefined,
    color: team.color || undefined,
    league: team.league || undefined,
  };
}

async function fetchTeamsByParams(params: {
  abbreviation?: string;
  name?: string;
  league?: string;
}): Promise<PolymarketTeam[]> {
  const url = new URL("https://gamma-api.polymarket.com/teams");

  if (params.abbreviation) {
    url.searchParams.set("abbreviation", params.abbreviation.toLowerCase());
  }

  if (params.name) {
    url.searchParams.set("name", params.name);
  }

  if (params.league) {
    url.searchParams.set("league", params.league.toLowerCase());
  }

  url.searchParams.set("limit", "25");
  url.searchParams.set("offset", "0");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed teams fetch with status ${res.status}`);
  }

  const teams: PolymarketTeam[] = await res.json();
  return Array.isArray(teams) ? teams : [];
}

async function resolveTeamByToken(
  token: string,
  fallbackName: string,
  league: string,
): Promise<{ team?: PolymarketTeam; matchedBy?: string }> {
  const cacheKey = `${league}:${token}:${fallbackName}`;

  if (teamCache.has(cacheKey)) {
    const cached = teamCache.get(cacheKey);
    return cached ? { team: cached, matchedBy: "cache" } : {};
  }

  const normalizedToken = normalize(token);
  const normalizedFallback = normalize(fallbackName);

  if (!normalizedToken && !normalizedFallback) {
    teamCache.set(cacheKey, null);
    return {};
  }

  if (normalizedToken) {
    const abbreviationResults = await fetchTeamsByParams({
      abbreviation: normalizedToken,
      league,
    });

    const exactAbbreviation = abbreviationResults.find(
      (team) => normalize(team.abbreviation || "") === normalizedToken,
    );

    if (exactAbbreviation) {
      teamCache.set(cacheKey, exactAbbreviation);
      return {
        team: exactAbbreviation,
        matchedBy: `abbreviation:${normalizedToken}+league:${league}`,
      };
    }

    if (abbreviationResults[0]) {
      teamCache.set(cacheKey, abbreviationResults[0]);
      return {
        team: abbreviationResults[0],
        matchedBy: `abbreviation-fallback:${normalizedToken}+league:${league}`,
      };
    }
  }

  if (fallbackName) {
    const nameResults = await fetchTeamsByParams({
      name: fallbackName,
      league,
    });

    const exactName = nameResults.find((team) => {
      const teamName = normalize(team.name || "");
      const teamAlias = normalize(team.alias || "");

      return (
        teamName === normalizedFallback ||
        teamAlias === normalizedFallback ||
        (teamName && normalizedFallback.includes(teamName)) ||
        (teamAlias && normalizedFallback.includes(teamAlias))
      );
    });

    if (exactName) {
      teamCache.set(cacheKey, exactName);
      return {
        team: exactName,
        matchedBy: `name:${fallbackName}+league:${league}`,
      };
    }

    if (nameResults[0]) {
      teamCache.set(cacheKey, nameResults[0]);
      return {
        team: nameResults[0],
        matchedBy: `name-fallback:${fallbackName}+league:${league}`,
      };
    }
  }

  teamCache.set(cacheKey, null);
  return {};
}

function isTradableMarket(market: PolymarketMarket) {
  return (
    market.archived !== true &&
    market.closed !== true &&
    market.active !== false &&
    market.acceptingOrders !== false
  );
}

function getMarketVolume(market: PolymarketMarket) {
  return parseNumericValue(market.volumeNum, market.volume, market.volumeClob);
}

function getSportsMarketType(market: PolymarketMarket) {
  return cleanText(String(market.sportsMarketType ?? "")).toLowerCase();
}

function isLikelyFullGameMoneylineMarket(
  event: PolymarketEvent,
  market: PolymarketMarket,
  leagueKey: LeagueKey,
): boolean {
  const sportsMarketType = getSportsMarketType(market);

  if (sportsMarketType && sportsMarketType !== "moneyline") {
    return false;
  }

  const slug = normalizeSlug(market.slug || "");
  const question = cleanText(market.question || "").toLowerCase();
  const eventTitle = cleanText(event.title || "").toLowerCase();
  const combined = `${slug} ${question} ${eventTitle}`;

  const bannedPatterns = [
    "1h",
    "2h",
    "first-half",
    "second-half",
    "first half",
    "second half",
    "1st-half",
    "2nd-half",
    "1st half",
    "2nd half",
    "1q",
    "2q",
    "3q",
    "4q",
    "quarter",
    "period",
    "innings",
    "inning",
    "spread",
    "total",
    "over/",
    "under/",
    "over ",
    "under ",
    "nrfi",
    "yrfi",
    "extra innings",
    "player",
    "parlay",
    "sgp",
    "series",
    "correct score",
    "wins by",
    "margin",
    "yes/no",
    "yes or no",
  ];

  if (bannedPatterns.some((pattern) => combined.includes(pattern))) {
    return false;
  }

  const positiveSignals = [
    `${leagueKey}-`,
    "moneyline",
    "match winner",
    "game winner",
    "who will win",
    "winner",
  ];

  const hasSignal = positiveSignals.some((signal) => combined.includes(signal));
  if (!hasSignal) {
    return false;
  }

  const parsedFromEvent = parseTeams(event.title || "");
  const parsedFromQuestion = parseTeams(market.question || "");

  return Boolean(parsedFromEvent || parsedFromQuestion);
}

function chooseCanonicalTeams(
  event: PolymarketEvent,
  market: PolymarketMarket,
): { away: string; home: string } | null {
  return (
    parseTeams(event.title || "") || parseTeams(market.question || "") || null
  );
}

function findOutcomeIndexForTeam(outcomes: string[], teamName: string): number {
  const teamNorm = normalize(teamName);

  return outcomes.findIndex((outcome) => {
    const outcomeNorm = normalize(outcome);
    return (
      outcomeNorm === teamNorm ||
      teamNorm.includes(outcomeNorm) ||
      outcomeNorm.includes(teamNorm)
    );
  });
}

function getMoneylineScore(market: PolymarketMarket) {
  const slug = normalizeSlug(market.slug || "");
  const question = cleanText(market.question || "").toLowerCase();

  return (
    (getSportsMarketType(market) === "moneyline" ? 4 : 0) +
    (slug.includes("moneyline") ? 2 : 0) +
    (question.includes("moneyline") ? 1 : 0) +
    (getMarketVolume(market) ?? 0) / 1_000_000
  );
}

function chooseMoneylineMarket(
  event: PolymarketEvent,
  markets: PolymarketMarket[],
  leagueKey: LeagueKey,
) {
  const eligible = markets
    .filter(isTradableMarket)
    .filter((market) => isLikelyFullGameMoneylineMarket(event, market, leagueKey))
    .filter((market) => {
      const volume = getMarketVolume(market);
      return volume !== null && volume > MIN_MARKET_VOLUME;
    });

  return eligible.sort((a, b) => getMoneylineScore(b) - getMoneylineScore(a))[0];
}

function chooseHighestVolumeMarket(
  markets: PolymarketMarket[],
  sportsMarketType: "spreads" | "totals",
) {
  const eligible = markets
    .filter(isTradableMarket)
    .filter((market) => getSportsMarketType(market) === sportsMarketType)
    .filter((market) => {
      const volume = getMarketVolume(market);
      return volume !== null && volume > MIN_MARKET_VOLUME;
    });

  return eligible.sort((a, b) => (getMarketVolume(b) ?? 0) - (getMarketVolume(a) ?? 0))[0];
}

function makePolymarketMeta(
  event: PolymarketEvent,
  market: PolymarketMarket,
  outcomes: string[],
  clobTokenIds: string[],
) {
  return {
    event_id: String(event.id),
    event_slug: event.slug ?? null,
    market_id: String(market.id),
    market_slug: market.slug ?? null,
    condition_id: market.conditionId ?? market.condition_id ?? null,
    question: market.question ?? null,
    outcomes,
    clob_token_ids: clobTokenIds,
    sports_market_type: getSportsMarketType(market) || null,
    volume: getMarketVolume(market),
    volume_24hr: parseNumericValue(market.volume24hr, market.volume24hrClob),
    liquidity: parseNumericValue(
      market.liquidityNum,
      market.liquidity,
      market.liquidityClob,
    ),
  };
}

function buildMoneylineOddsMarket(
  event: PolymarketEvent,
  market: PolymarketMarket,
  teams: { away: string; home: string },
): { market: OddsMarket; awayTokenId?: string; homeTokenId?: string } | null {
  const outcomes = parseStringArray(market.outcomes).map(cleanText);
  const prices = parseStringArray(market.outcomePrices).map(Number);
  const clobTokenIds = parseStringArray(market.clobTokenIds);

  if (outcomes.length !== 2 || prices.length !== 2) return null;

  const awayIndex = findOutcomeIndexForTeam(outcomes, teams.away);
  const homeIndex = findOutcomeIndexForTeam(outcomes, teams.home);

  if (awayIndex === -1 || homeIndex === -1 || awayIndex === homeIndex) {
    return null;
  }

  const polymarket = makePolymarketMeta(event, market, outcomes, clobTokenIds);

  return {
    market: {
      key: "h2h",
      label: "Moneyline",
      outcomes: [awayIndex, homeIndex].map((index) => ({
        name: outcomes[index],
        price: probabilityToAmerican(prices[index]),
        tokenId: clobTokenIds[index],
        polymarketOutcome: outcomes[index],
        polymarketOutcomeIndex: index,
      })),
      polymarket,
    },
    awayTokenId: clobTokenIds[awayIndex],
    homeTokenId: clobTokenIds[homeIndex],
  };
}

function buildSpreadOddsMarket(
  event: PolymarketEvent,
  market: PolymarketMarket,
  teams: { away: string; home: string },
): OddsMarket | null {
  const outcomes = parseStringArray(market.outcomes).map(cleanText);
  const prices = parseStringArray(market.outcomePrices).map(Number);
  const clobTokenIds = parseStringArray(market.clobTokenIds);
  const line = parseNumericValue(market.line);

  if (outcomes.length !== 2 || prices.length !== 2 || line === null) return null;

  const awayIndex = findOutcomeIndexForTeam(outcomes, teams.away);
  const homeIndex = findOutcomeIndexForTeam(outcomes, teams.home);

  if (awayIndex === -1 || homeIndex === -1 || awayIndex === homeIndex) {
    return null;
  }

  const polymarket = makePolymarketMeta(event, market, outcomes, clobTokenIds);

  return {
    key: "spreads",
    label: `Spread ${line > 0 ? "+" : ""}${line}`,
    line,
    outcomes: [awayIndex, homeIndex].map((index) => ({
      name: outcomes[index],
      price: probabilityToAmerican(prices[index]),
      point: index === 0 ? line : -line,
      tokenId: clobTokenIds[index],
      polymarketOutcome: outcomes[index],
      polymarketOutcomeIndex: index,
    })),
    polymarket,
  };
}

function buildTotalsOddsMarket(
  event: PolymarketEvent,
  market: PolymarketMarket,
): OddsMarket | null {
  const outcomes = parseStringArray(market.outcomes).map(cleanText);
  const prices = parseStringArray(market.outcomePrices).map(Number);
  const clobTokenIds = parseStringArray(market.clobTokenIds);
  const line = parseNumericValue(market.line);

  if (outcomes.length !== 2 || prices.length !== 2 || line === null) return null;

  const overIndex = outcomes.findIndex((outcome) => normalize(outcome) === "over");
  const underIndex = outcomes.findIndex((outcome) => normalize(outcome) === "under");

  if (overIndex === -1 || underIndex === -1 || overIndex === underIndex) {
    return null;
  }

  const polymarket = makePolymarketMeta(event, market, outcomes, clobTokenIds);

  return {
    key: "totals",
    label: `O/U ${line}`,
    line,
    outcomes: [overIndex, underIndex].map((index) => ({
      name: outcomes[index],
      price: probabilityToAmerican(prices[index]),
      point: line,
      tokenId: clobTokenIds[index],
      polymarketOutcome: outcomes[index],
      polymarketOutcomeIndex: index,
    })),
    polymarket,
  };
}

function makeDedupeKey(
  leagueKey: LeagueKey,
  event: PolymarketEvent,
  awayTeam: string,
  homeTeam: string,
  commenceTime: string,
) {
  const eventSlug = normalizeSlug(event.slug || "");
  const away = normalize(awayTeam);
  const home = normalize(homeTeam);
  const day = commenceTime.slice(0, 10);

  return `${leagueKey}:${eventSlug || day}:${away}:${home}`;
}

async function buildGameFromEvent(
  event: PolymarketEvent,
  league: { key: LeagueKey; label: string; tag: number; teamLeague: string },
): Promise<EventOdds | null> {
  const markets = Array.isArray(event.markets) ? event.markets : [];
  const moneylineMarket = chooseMoneylineMarket(event, markets, league.key);

  if (!moneylineMarket) return null;

  const teams = chooseCanonicalTeams(event, moneylineMarket);
  if (!teams) return null;

  const commenceTime = getCommenceTime(event, moneylineMarket);

  if (!isWithinEligibleGameWindowFromNowUtc(commenceTime)) {
    return null;
  }

  const moneyline = buildMoneylineOddsMarket(event, moneylineMarket, teams);
  if (!moneyline) return null;

  const bestSpreadMarket = chooseHighestVolumeMarket(markets, "spreads");
  const bestTotalMarket = chooseHighestVolumeMarket(markets, "totals");

  const spread = bestSpreadMarket
    ? buildSpreadOddsMarket(event, bestSpreadMarket, teams)
    : null;

  const total = bestTotalMarket ? buildTotalsOddsMarket(event, bestTotalMarket) : null;

  const slugTokens = extractSlugTokens(
    moneylineMarket.slug || event.slug,
    league.key,
  );
  const awaySlugToken = slugTokens.length >= 2 ? slugTokens[0] : "";
  const homeSlugToken = slugTokens.length >= 2 ? slugTokens[1] : "";

  const [awayResolved, homeResolved] = await Promise.all([
    resolveTeamByToken(awaySlugToken, teams.away, league.teamLeague),
    resolveTeamByToken(homeSlugToken, teams.home, league.teamLeague),
  ]);

  const oddsMarkets = [moneyline.market, spread, total].filter(
    (market): market is OddsMarket => Boolean(market),
  );

  const moneylineMeta = moneyline.market.polymarket;

  return {
    id: `${league.key}-${String(moneylineMarket.id)}`,
    slug: event.slug || moneylineMarket.slug || `${league.key}-${String(moneylineMarket.id)}`,
    sport_key: league.key,
    sport_title: league.label,
    commence_time: commenceTime,
    isLive: hasGameStarted(commenceTime),
    away_team: teams.away,
    home_team: teams.home,
    away_team_info: awayResolved.team
      ? makeTeamInfo(awayResolved.team)
      : undefined,
    home_team_info: homeResolved.team
      ? makeTeamInfo(homeResolved.team)
      : undefined,
    bookmakers: [
      {
        key: "polymarket",
        title: "Polymarket",
        last_update: new Date().toISOString(),
        markets: oddsMarkets,
      },
    ],

    polymarket: moneylineMeta
      ? {
          event_id: moneylineMeta.event_id,
          event_slug: moneylineMeta.event_slug,
          market_id: moneylineMeta.market_id,
          market_slug: moneylineMeta.market_slug,
          condition_id: moneylineMeta.condition_id,
          question: moneylineMeta.question,
          outcomes: moneylineMeta.outcomes,
          clob_token_ids: moneylineMeta.clob_token_ids,
          volume: moneylineMeta.volume,
          volume_24hr: moneylineMeta.volume_24hr,
          liquidity: moneylineMeta.liquidity,
        }
      : undefined,

    outcome_token_ids: {
      away: moneyline.awayTokenId,
      home: moneyline.homeTokenId,
    },

    debug: {
      eventSlug: event.slug,
      marketSlug: moneylineMarket.slug,
      eventTitle: event.title,
      question: moneylineMarket.question,
      outcomes: moneyline.market.polymarket?.outcomes,
      clobTokenIds: moneyline.market.polymarket?.clob_token_ids,
      awaySlugTokens: awaySlugToken ? [awaySlugToken] : [],
      homeSlugTokens: homeSlugToken ? [homeSlugToken] : [],
      awayMatchedBy: awayResolved.matchedBy,
      homeMatchedBy: homeResolved.matchedBy,
      addedMarkets: oddsMarkets.map((market) => market.key),
    },
  };
}

export async function fetchLeagueGames(league: {
  key: LeagueKey;
  label: string;
  tag: number;
  teamLeague: string;
}): Promise<EventOdds[]> {
  const url = new URL("https://gamma-api.polymarket.com/events");
  url.searchParams.set("tag_id", String(league.tag));
  url.searchParams.set("limit", "100");
  url.searchParams.set("closed", "false");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed with status ${res.status}`);
  }

  const events: PolymarketEvent[] = await res.json();

  const builtGames = await Promise.all(
    events
      .filter((event) => event.archived !== true)
      .filter((event) => event.closed !== true)
      .map((event) => buildGameFromEvent(event, league)),
  );

  const games = builtGames.filter((game): game is EventOdds => Boolean(game));

  const dedupedMap = new Map<string, EventOdds>();

  for (const game of games) {
    const dedupeKey = makeDedupeKey(
      league.key,
      { id: "", slug: game.debug?.eventSlug } as PolymarketEvent,
      game.away_team,
      game.home_team,
      game.commence_time,
    );

    const existing = dedupedMap.get(dedupeKey);

    if (!existing) {
      dedupedMap.set(dedupeKey, game);
      continue;
    }

    const existingMarketCount = existing.bookmakers[0]?.markets.length ?? 0;
    const currentMarketCount = game.bookmakers[0]?.markets.length ?? 0;
    const existingVolume = existing.polymarket?.volume ?? 0;
    const currentVolume = game.polymarket?.volume ?? 0;

    if (
      currentMarketCount > existingMarketCount ||
      (currentMarketCount === existingMarketCount && currentVolume > existingVolume)
    ) {
      dedupedMap.set(dedupeKey, game);
    }
  }

  const dedupedGames = Array.from(dedupedMap.values()).sort((a, b) => {
    return Date.parse(a.commence_time) - Date.parse(b.commence_time);
  });

  console.log(
    `[${league.key}] raw=${games.length} deduped=${dedupedGames.length}`,
  );

  for (const game of dedupedGames.slice(0, 8)) {
    console.log(
      `[${league.key}] final`,
      JSON.stringify(
        {
          away: game.away_team,
          awayColor: game.away_team_info?.color,
          home: game.home_team,
          homeColor: game.home_team_info?.color,
          commenceTime: game.commence_time,
          isLive: game.isLive,
          markets: game.bookmakers[0]?.markets.map((market) => ({
            key: market.key,
            label: market.label,
            line: market.line,
            volume: market.polymarket?.volume,
            conditionId: market.polymarket?.condition_id,
          })),
          eventSlug: game.debug?.eventSlug,
        },
        null,
        2,
      ),
    );
  }

  return dedupedGames;
}

export async function fetchEligibleLeagueGames(): Promise<LeagueResponse[]> {
  return Promise.all(
    LEAGUES.map(async (league): Promise<LeagueResponse> => {
      try {
        const games = await fetchLeagueGames(league);

        return {
          leagueKey: league.key,
          leagueLabel: league.label,
          games,
        };
      } catch (error) {
        return {
          leagueKey: league.key,
          leagueLabel: league.label,
          games: [],
          error: error instanceof Error ? error.message : "Fetch failed",
        };
      }
    }),
  );
}

export function flattenLeagueGames(leagues: LeagueResponse[]): EventOdds[] {
  return leagues.flatMap((league) => league.games);
}