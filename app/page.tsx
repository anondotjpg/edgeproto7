import Link from "next/link";
import { headers } from "next/headers";
import { FiArrowUpRight } from "react-icons/fi";
import LastUpdatedAgo from "./components/LastUpdatedAgo";
import LeagueTabs from "./components/LeagueTabs";
import BetSlipModal from "@/app/components/BetSlipModal";

type OddsOutcome = {
  name: string;
  price: number;
};

type OddsMarket = {
  key: string;
  outcomes: OddsOutcome[];
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
};

type Game = {
  id: string;
  slug: string;
  sport_key: string;
  commence_time: string;
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
  };

  outcome_token_ids?: {
    away?: string;
    home?: string;
  };
};

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

const LEAGUES = [
  { label: "NBA", tag: 745, league: "nba" },
  { label: "NHL", tag: 899, league: "nhl" },
  { label: "MLB", tag: 100381, league: "mlb" },
] as const;

type LeagueKey = (typeof LEAGUES)[number]["league"];

async function getOdds(): Promise<ApiResponse> {
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (!host) {
    throw new Error("Missing host header");
  }

  const protocol = host.includes("localhost") ? "http" : "https";

  const res = await fetch(`${protocol}://${host}/api/odds`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch odds");
  }

  return res.json();
}

function getMarket(bookmaker: Bookmaker | undefined, marketKey: string) {
  return bookmaker?.markets.find((market) => market.key === marketKey);
}

function getOutcomeByName(
  outcomes: OddsOutcome[] | undefined,
  teamName: string
) {
  return outcomes?.find((outcome) => outcome.name === teamName);
}

function formatPrice(price?: number) {
  if (!price) return "—";
  return price > 0 ? `+${price}` : `${price}`;
}

function formatImpliedPercent(price?: number) {
  if (price === undefined || price === null || price === 0) return "—";

  const probability =
    price > 0 ? 100 / (price + 100) : Math.abs(price) / (Math.abs(price) + 100);

  return `${Math.round(probability * 100)}%`;
}

function formatGameTime(date: string) {
  const formatted = new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatted} EST`;
}

function getLogoClassName(sportKey: string) {
  return sportKey === "mlb"
    ? "h-8 w-8 object-contain"
    : "h-8 w-8 rounded-sm bg-white/5 object-contain";
}

function getLogoFallbackClassName(sportKey: string) {
  return sportKey === "mlb"
    ? "h-9 w-9 bg-zinc-950"
    : "h-9 w-9 rounded-sm bg-zinc-950";
}

function MoneylineCell({
  game,
  team,
  outcome,
  side,
}: {
  game: Game;
  team: string;
  outcome?: OddsOutcome;
  side: "away" | "home";
}) {
  const odds = formatPrice(outcome?.price);
  const impliedPercent = formatImpliedPercent(outcome?.price);

  const polymarketTokenId =
    side === "away"
      ? game.outcome_token_ids?.away
      : game.outcome_token_ids?.home;

  return (
    <div
      className="rounded-xl bg-zinc-800"
      style={{
        paddingBottom: "2px",
        lineHeight: 0,
      }}
    >
      <BetSlipModal
        team={team}
        gameId={game.id}
        league={game.sport_key}
        market="h2h"
        odds={odds}
        impliedPercent={impliedPercent}
        matchup={`${game.away_team} vs. ${game.home_team}`}
        triggerClassName="flex h-[56px] w-full translate-y-[-2px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-center transition-[transform,border-color] duration-100 hover:translate-y-[-1px] active:translate-y-0"
        triggerContentClassName="text-[14px] font-semibold tracking-tight text-zinc-100"
        polymarketEventId={game.polymarket?.event_id ?? null}
        polymarketEventSlug={game.polymarket?.event_slug ?? null}
        polymarketMarketId={game.polymarket?.market_id ?? null}
        polymarketConditionId={game.polymarket?.condition_id ?? null}
        polymarketMarketSlug={game.polymarket?.market_slug ?? null}
        polymarketOutcome={team}
        polymarketOutcomeIndex={side === "away" ? 0 : 1}
        polymarketTokenId={polymarketTokenId ?? null}
      />
    </div>
  );
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
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-3 py-2">
      {info?.logo ? (
        <img
          src={info.logo}
          alt={info.name}
          className={getLogoClassName(sportKey)}
        />
      ) : (
        <div className={getLogoFallbackClassName(sportKey)} />
      )}

      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium text-zinc-100">
          {info?.name || team}
        </div>

        <div className="truncate text-[12px] text-zinc-400">
          {info?.record || info?.abbreviation || info?.alias || "—"}
        </div>
      </div>
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const bookmaker = game.bookmakers[0];
  const h2h = getMarket(bookmaker, "h2h")?.outcomes;

  const awayMoneyline = getOutcomeByName(h2h, game.away_team);
  const homeMoneyline = getOutcomeByName(h2h, game.home_team);
  const eventHref = `/event/${game.slug}`;

  return (
    <article className="relative pb-9 md:rounded-2xl md:border md:border-zinc-900 md:p-4 md:pb-12">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_96px]">
        <div className="pl-1 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Teams
        </div>

        <div className="flex items-center justify-center text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          ML
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_96px]">
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
          <MoneylineCell
            game={game}
            team={game.away_team}
            outcome={awayMoneyline}
            side="away"
          />

          <MoneylineCell
            game={game}
            team={game.home_team}
            outcome={homeMoneyline}
            side="home"
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-1 text-[13px] text-zinc-400 md:bottom-4 md:left-4">
        {formatGameTime(game.commence_time)}
      </div>

      <Link
        href={eventHref}
        className="absolute bottom-0 right-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-white md:bottom-4 md:right-4"
      >
        <span>View</span>
        <FiArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string }>;
}) {
  const data = await getOdds();
  const resolvedSearchParams = await searchParams;
  const requestedLeague = resolvedSearchParams?.league;

  const selectedLeague: LeagueKey = LEAGUES.some(
    (item) => item.league === requestedLeague
  )
    ? (requestedLeague as LeagueKey)
    : "nba";

  const league =
    data.leagues.find((item) => item.leagueKey === selectedLeague) ??
    data.leagues[0];

  const selectedLeagueMeta =
    LEAGUES.find((item) => item.league === selectedLeague) ?? LEAGUES[0];

  const totalGames = league?.games.length ?? 0;

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white">
      <div className="relative mx-auto w-full max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-6 md:pb-6">
        <header className="pt-2">
          <LeagueTabs leagues={LEAGUES} selectedLeague={selectedLeague} />
        </header>

        <main className="mt-8 sm:mt-4">
          <section className="space-y-4">
            <div className="grid grid-cols-[112px_minmax(0,1fr)_112px] items-end gap-3">
              <LastUpdatedAgo updatedAt={data.updatedAt} />

              <div className="hidden min-w-0 text-center sm:block">
                <h2 className="text-[33px] font-semibold leading-none tracking-tight text-zinc-50">
                  {league?.leagueLabel ?? selectedLeagueMeta.label}
                </h2>

                <p className="mt-0.5 text-[12px] leading-none text-zinc-400">
                  {totalGames} game{totalGames === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex w-[112px] justify-end">
                {league?.error ? (
                  <div className="hidden rounded-full border border-red-900/60 bg-red-950/60 px-3 py-1 text-[11px] font-medium text-red-400 sm:block">
                    {league.error}
                  </div>
                ) : null}
              </div>
            </div>

            {!league || league.games.length === 0 ? (
              <div className="rounded-[18px] border border-zinc-800 p-5 text-[13px] text-zinc-400">
                No active {selectedLeagueMeta.label} markets right now.
              </div>
            ) : (
              <div className="grid gap-6 md:gap-3 lg:grid-cols-2">
                {league.games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}