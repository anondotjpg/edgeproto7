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
  return (
    <div
      aria-hidden="true"
      className="relative -mt-3 h-[220px] w-full min-w-0 animate-pulse overflow-visible sm:mt-0 sm:h-[260px]"
    >
      <div className="pointer-events-none absolute inset-y-0 left-2 right-3 overflow-visible">
        {/* Mobile */}
        <svg
          viewBox="0 0 1000 220"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible sm:hidden"
          style={{ overflow: "visible" }}
        >
          <path
            d="
              M0 112
              C45 97, 91 55, 148 48
              C205 42, 247 93, 304 151
              C361 182, 405 173, 460 118
              C516 63, 555 38, 616 52
              C677 68, 714 135, 770 174
              C827 188, 869 142, 920 82
              C956 50, 981 58, 1000 72
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
              M0 138
              C51 158, 96 181, 153 171
              C210 159, 249 101, 305 55
              C363 37, 404 53, 460 108
              C518 164, 554 184, 614 166
              C674 148, 712 80, 770 46
              C828 34, 867 75, 920 139
              C957 174, 981 164, 1000 148
            "
            fill="none"
            stroke="rgba(113,113,122,0.42)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Desktop */}
        <svg
          viewBox="0 0 1000 260"
          preserveAspectRatio="none"
          className="absolute inset-0 hidden h-full w-full overflow-visible sm:block"
          style={{ overflow: "visible" }}
        >
          <path
            d="
              M0 132
              C45 114, 91 65, 148 57
              C205 49, 247 110, 304 179
              C361 215, 405 204, 460 139
              C516 74, 555 45, 616 61
              C677 80, 714 160, 770 206
              C827 222, 869 168, 920 97
              C956 59, 981 69, 1000 85
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
              M0 163
              C51 187, 96 214, 153 202
              C210 188, 249 119, 305 65
              C363 44, 404 63, 460 128
              C518 194, 554 217, 614 196
              C674 175, 712 94, 770 54
              C828 40, 867 89, 920 164
              C957 205, 981 193, 1000 175
            "
            fill="none"
            stroke="rgba(113,113,122,0.42)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Mobile dots */}
        <span
          className="absolute h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b] sm:hidden"
          style={{
            right: "-4.5px",
            top: `${(72 / 220) * 100}%`,
            backgroundColor: "#f4f4f5",
          }}
        />

        <span
          className="absolute h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b] sm:hidden"
          style={{
            right: "-4.5px",
            top: `${(148 / 220) * 100}%`,
            backgroundColor: "#71717a",
          }}
        />

        {/* Desktop dots */}
        <span
          className="absolute hidden h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b] sm:block"
          style={{
            right: "-4.5px",
            top: `${(85 / 260) * 100}%`,
            backgroundColor: "#f4f4f5",
          }}
        />

        <span
          className="absolute hidden h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-[#09090b] sm:block"
          style={{
            right: "-4.5px",
            top: `${(175 / 260) * 100}%`,
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