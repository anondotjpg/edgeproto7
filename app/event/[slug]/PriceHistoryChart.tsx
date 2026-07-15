"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type HistoryPoint = {
  t: number;
  p: number;
};

type PriceHistoryResponse = {
  updatedAt: string;
  away: {
    label: string;
    tokenId?: string;
    history: HistoryPoint[];
  };
  home: {
    label: string;
    tokenId?: string;
    history: HistoryPoint[];
  };
  error?: string;
};

type Props = {
  slug: string;
  awayColor?: string | null;
  homeColor?: string | null;
};

type EndDotProps = {
  cx?: number;
  cy?: number;
  stroke?: string;
  index?: number;
  points?: unknown[];
};

function formatTimeLabel(timestampSeconds: number) {
  return new Date(timestampSeconds * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeChartColor(
  color: string | null | undefined,
  fallback: string,
) {
  const clean = color?.trim();

  if (!clean) return fallback;

  if (/^#[0-9a-fA-F]{3}$/.test(clean)) return clean;
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-fA-F]{8}$/.test(clean)) return clean;

  if (/^[0-9a-fA-F]{3}$/.test(clean)) return `#${clean}`;
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean}`;
  if (/^[0-9a-fA-F]{8}$/.test(clean)) return `#${clean}`;

  if (/^(rgb|rgba|hsl|hsla)\(/i.test(clean)) return clean;

  return fallback;
}

function EndDot(props: EndDotProps) {
  const points = props.points;
  const index = props.index;

  if (
    !points ||
    index !== points.length - 1 ||
    props.cx === undefined ||
    props.cy === undefined
  ) {
    return null;
  }

  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={3.5}
      fill={props.stroke}
      stroke="#09090b"
      strokeWidth={2}
      opacity={0}
    >
      <animate
        attributeName="opacity"
        from="0"
        to="1"
        dur="0.18s"
        begin="0.42s"
        fill="freeze"
      />

      <animate
        attributeName="r"
        from="1"
        to="3.5"
        dur="0.18s"
        begin="0.42s"
        fill="freeze"
      />
    </circle>
  );
}

function ChartLegend({
  awayLabel,
  homeLabel,
  awayStroke,
  homeStroke,
}: {
  awayLabel?: string;
  homeLabel?: string;
  awayStroke: string;
  homeStroke: string;
}) {
  return (
    <div className="mt-1 flex items-center justify-center gap-4 text-[12px] font-medium text-zinc-300">
      <div className="flex items-center gap-1.5">
        <span
          className="h-[2px] w-4 rounded-full"
          style={{ backgroundColor: awayStroke }}
        />

        <span>{awayLabel || "Away"}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className="h-[2px] w-4 rounded-full"
          style={{ backgroundColor: homeStroke }}
        />

        <span>{homeLabel || "Home"}</span>
      </div>
    </div>
  );
}

function PriceHistoryChartSkeleton() {
  const awayEndY = 98;
  const homeEndY = 128;

  return (
    <div
      aria-hidden="true"
      className="relative -mt-3 h-[220px] w-full min-w-0 animate-pulse overflow-visible sm:mt-0 sm:h-[260px]"
    >
      <div className="pointer-events-none absolute inset-y-0 left-2 right-3 overflow-visible">
        <svg
          viewBox="0 0 1000 220"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible sm:hidden"
          style={{ overflow: "visible" }}
        >
          <path
            d="
              M0 124
              C48 118, 90 84, 148 94
              C205 104, 242 158, 304 140
              C364 122, 398 72, 457 89
              C516 106, 555 164, 616 143
              C677 122, 709 65, 768 85
              C828 105, 862 157, 918 130
              C955 113, 980 85, 1000 98
            "
            fill="none"
            stroke="rgba(244,244,245,0.3)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          <path
            d="
              M0 145
              C55 162, 97 143, 152 119
              C210 94, 247 73, 305 99
              C365 126, 402 169, 459 149
              C518 129, 550 75, 613 94
              C674 113, 708 165, 768 142
              C828 119, 862 70, 918 91
              C956 105, 981 153, 1000 128
            "
            fill="none"
            stroke="rgba(113,113,122,0.42)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <svg
          viewBox="0 0 1000 260"
          preserveAspectRatio="none"
          className="absolute inset-0 hidden h-full w-full overflow-visible sm:block"
          style={{ overflow: "visible" }}
        >
          <path
            d="
              M0 146
              C48 139, 90 99, 148 111
              C205 123, 242 187, 304 165
              C364 144, 398 85, 457 105
              C516 125, 555 194, 616 169
              C677 144, 709 77, 768 101
              C828 125, 862 185, 918 154
              C955 134, 980 101, 1000 116
            "
            fill="none"
            stroke="rgba(244,244,245,0.3)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          <path
            d="
              M0 171
              C55 191, 97 169, 152 141
              C210 111, 247 86, 305 117
              C365 149, 402 200, 459 176
              C518 152, 550 89, 613 111
              C674 134, 708 195, 768 168
              C828 141, 862 83, 918 107
              C956 124, 981 180, 1000 151
            "
            fill="none"
            stroke="rgba(113,113,122,0.42)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span
          className="absolute h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b]"
          style={{
            right: "-4.5px",
            top: `${(awayEndY / 220) * 100}%`,
            backgroundColor: "#f4f4f5",
          }}
        />

        <span
          className="absolute h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b]"
          style={{
            right: "-4.5px",
            top: `${(homeEndY / 220) * 100}%`,
            backgroundColor: "#71717a",
          }}
        />

        <span
          className="absolute hidden h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b] sm:block"
          style={{
            right: "-4.5px",
            top: `${(116 / 260) * 100}%`,
            backgroundColor: "#f4f4f5",
          }}
        />

        <span
          className="absolute hidden h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b] sm:block"
          style={{
            right: "-4.5px",
            top: `${(151 / 260) * 100}%`,
            backgroundColor: "#71717a",
          }}
        />
      </div>
    </div>
  );
}

export default function PriceHistoryChart({
  slug,
  awayColor,
  homeColor,
}: Props) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);

  const awayStroke = useMemo(() => {
    return normalizeChartColor(awayColor, "#ffffff");
  }, [awayColor]);

  const homeStroke = useMemo(() => {
    return normalizeChartColor(homeColor, "#71717a");
  }, [homeColor]);

  useEffect(() => {
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      setIsLoading(true);
      setShowChart(false);

      try {
        const res = await fetch(
          `/api/event/${encodeURIComponent(slug)}/price-history`,
          {
            cache: "no-store",
          },
        );

        const json = (await res.json()) as PriceHistoryResponse;

        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          revealTimer = setTimeout(() => {
            if (!cancelled) {
              setIsLoading(false);
              setShowChart(true);
            }
          }, 250);
        }
      }
    }

    load();

    return () => {
      cancelled = true;

      if (revealTimer) {
        clearTimeout(revealTimer);
      }
    };
  }, [slug]);

  const chartData = useMemo(() => {
    if (!data) return [];

    const awayMap = new Map<number, number>(
      data.away.history.map((point) => [point.t, point.p]),
    );

    const homeMap = new Map<number, number>(
      data.home.history.map((point) => [point.t, point.p]),
    );

    const timestamps = Array.from(
      new Set([...awayMap.keys(), ...homeMap.keys()]),
    ).sort((a, b) => a - b);

    return timestamps.map((t) => ({
      t,
      away: awayMap.get(t),
      home: homeMap.get(t),
    }));
  }, [data]);

  if (!isLoading && (!data || data.error || chartData.length === 0)) {
    return (
      <div className="mt-8 min-w-0 rounded-[28px] bg-zinc-950 sm:p-6">
        <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          History
        </div>

        <div className="mt-3 text-[13px] text-zinc-400">
          No price history available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 min-w-0 rounded-[28px] bg-zinc-950 sm:p-6">
      <div className="mb-4">
        <div className="text-[12px] font-medium capitalize tracking-[0.18em] text-zinc-500">
          History
        </div>
      </div>

      <div className="relative w-full min-w-0 overflow-visible rounded-2xl">
        {showChart ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.45,
              ease: "easeInOut",
            }}
            className="w-full min-w-0"
            tabIndex={-1}
            onMouseDown={(event) => {
              event.currentTarget.blur();
            }}
          >
            <div className="w-full min-w-0 rounded-2xl outline-none focus:outline-none [&_*:focus]:outline-none">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={chartData}
                  margin={{
                    top: 8,
                    right: 12,
                    left: 0,
                    bottom: 12,
                  }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.08)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) =>
                      formatTimeLabel(Number(value))
                    }
                    minTickGap={32}
                    tick={{
                      fill: "#a1a1aa",
                      fontSize: 12,
                    }}
                    tickMargin={10}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(value) =>
                      `${Math.round(Number(value) * 100)}%`
                    }
                    tick={{
                      fill: "#a1a1aa",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />

                  <Legend
                    verticalAlign="bottom"
                    content={
                      <ChartLegend
                        awayLabel={data?.away.label}
                        homeLabel={data?.home.label}
                        awayStroke={awayStroke}
                        homeStroke={homeStroke}
                      />
                    }
                  />

                  <Line
                    type="linear"
                    dataKey="away"
                    name={data?.away.label}
                    stroke={awayStroke}
                    strokeWidth={2}
                    dot={<EndDot />}
                    activeDot={false}
                    connectNulls
                    isAnimationActive
                  />

                  <Line
                    type="linear"
                    dataKey="home"
                    name={data?.home.label}
                    stroke={homeStroke}
                    strokeWidth={2}
                    dot={<EndDot />}
                    activeDot={false}
                    connectNulls
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ) : (
          <PriceHistoryChartSkeleton />
        )}
      </div>
    </div>
  );
}