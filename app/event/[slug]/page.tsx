import { headers } from "next/headers";
import PriceHistoryChart from "./PriceHistoryChart";
import BackButton from "./BackButton";
import EventBettingClient from "./EventBettingClient";

export type OddsOutcome = {
  name: string;
  price: number;
  point?: number;
  tokenId?: string;
  polymarketOutcome?: string;
  polymarketOutcomeIndex?: number;
};

export type OddsMarket = {
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

export type Game = {
  id: string;
  slug: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  isLive?: boolean;
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
    volume?: number | null;
    volume_24hr?: number | null;
    liquidity?: number | null;
  };

  outcome_token_ids?: {
    away?: string;
    home?: string;
  };

  debug?: unknown;
};

type EventResponse = {
  updatedAt: string;
  game: Game | null;
  error?: string;
};

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

async function getEvent(slug: string): Promise<EventResponse> {
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (!host) {
    throw new Error("Missing host header");
  }

  const protocol = host.includes("localhost") ? "http" : "https";

  const res = await fetch(
    `${protocol}://${host}/api/event/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    },
  );

  const data = (await res.json()) as EventResponse;

  if (!res.ok) {
    return data;
  }

  return data;
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const data = await getEvent(slug);
  const game = data.game;

  if (!game) {
    return (
      <div className="relative min-h-screen bg-[#09090b] text-white">
        <div className="relative mx-auto w-full max-w-[1480px] px-4 pt-8 pb-24 sm:px-6 sm:py-6 md:pb-6">
          <header className="h-[38px] pt-2 xl:pr-[420px]">
            <div className="invisible">
              <BackButton />
            </div>
          </header>

          <div className="mt-4 md:mt-8">
            <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Event not found
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                {data.error ||
                  "This game may no longer be active or the slug no longer matches."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white">
      <div className="relative mx-auto w-full max-w-[1660px] px-4 pt-8 pb-24 sm:px-6 sm:py-6 md:pb-6">
        <header className="h-[38px] pt-2 xl:pr-[420px]">
          <div className="invisible">
            <BackButton />
          </div>
        </header>

        <EventBettingClient game={game}>
          <PriceHistoryChart
            slug={game.slug}
            awayColor={game.away_team_info?.color}
            homeColor={game.home_team_info?.color}
          />
        </EventBettingClient>
      </div>
    </div>
  );
}