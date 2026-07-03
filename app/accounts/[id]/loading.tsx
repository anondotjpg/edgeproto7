function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-900 ${className}`} />;
}

function TopSummarySkeleton() {
  return (
    <div className="flex min-h-[132px] min-w-0 flex-col overflow-visible sm:min-h-[166px] lg:min-h-[166px]">
      <div className="flex min-w-0 items-start">
        <SkeletonBlock className="h-3.5 w-28 max-w-[60%] sm:h-7 sm:w-52 lg:h-7" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pt-3 pb-2 text-center sm:items-start sm:justify-start sm:pt-5 sm:pb-0 sm:text-left">
        <div className="flex max-w-full items-end justify-center sm:justify-start">
          <div className="flex min-w-0 items-end">
            <SkeletonBlock className="h-11 w-44 max-w-[calc(100vw-120px)] rounded-lg sm:h-11 sm:w-56 lg:h-12" />
            <SkeletonBlock className="ml-1 mb-1 h-6 w-12 rounded-lg bg-zinc-900/75 sm:h-6 sm:w-16" />
          </div>

          <SkeletonBlock className="ml-3 mb-1 hidden h-3.5 w-24 shrink-0 sm:block lg:h-4" />
        </div>

        <SkeletonBlock className="mt-2 h-3.5 w-32 sm:mt-3 sm:h-4 sm:w-36" />
      </div>
    </div>
  );
}

function BarsSkeleton({ barCount }: { barCount: number }) {
  return (
    <div className="flex h-8 w-full items-center sm:h-9">
      <div
        className="grid h-6 w-full items-stretch gap-[3px] sm:h-7"
        style={{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: barCount }).map((_, index) => (
          <SkeletonBlock key={index} className="min-w-0 rounded-full" />
        ))}
      </div>
    </div>
  );
}

function ResponsiveBarsSkeleton() {
  return (
    <>
      <div className="md:hidden">
        <BarsSkeleton barCount={42} />
      </div>

      <div className="hidden md:block xl:hidden">
        <BarsSkeleton barCount={53} />
      </div>

      <div className="hidden xl:block">
        <BarsSkeleton barCount={63} />
      </div>
    </>
  );
}

function GoalBarsSkeleton() {
  return <ResponsiveBarsSkeleton />;
}

function GoalSkeleton() {
  return (
    <div className="relative flex min-h-[132px] flex-col overflow-hidden rounded-[26px] bg-zinc-950/80 px-4 py-4 shadow-[inset_0_0_36px_rgba(161,161,170,0.08),inset_0_1px_0_rgba(244,244,245,0.04)] ring-1 ring-zinc-900 sm:min-h-[166px] sm:px-5 lg:ring-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(161,161,170,0.12),transparent_56%),radial-gradient(circle_at_50%_100%,rgba(39,39,42,0.28),transparent_62%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px rounded-[25px] shadow-[inset_0_0_24px_rgba(212,212,216,0.06)]"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[17px] font-medium leading-tight text-zinc-500">
            Goal
          </div>

          <SkeletonBlock className="mt-2 hidden h-[34px] w-36 sm:block sm:w-40" />
          <SkeletonBlock className="mt-1 hidden h-4 w-32 sm:block" />
        </div>

        <div className="min-w-0 pt-0.5 text-right sm:hidden">
          <SkeletonBlock className="ml-auto h-[26px] w-28" />
          <SkeletonBlock className="ml-auto mt-1 h-4 w-24" />
        </div>
      </div>

      <div className="relative mt-auto pt-2">
        <GoalBarsSkeleton />
      </div>
    </div>
  );
}

function LossRuleBarsSkeleton() {
  return (
    <>
      <div className="md:hidden">
        <BarsSkeleton barCount={21} />
      </div>

      <div className="hidden md:block xl:hidden">
        <BarsSkeleton barCount={53} />
      </div>

      <div className="hidden xl:block">
        <BarsSkeleton barCount={63} />
      </div>
    </>
  );
}

function MobileTwoLineRuleTitle({
  title,
  className,
}: {
  title: string;
  className: string;
}) {
  const [firstWord, ...remainingWords] = title.split(" ");
  const restTitle = remainingWords.join(" ");

  return (
    <div className={className}>
      <span className="block sm:inline">{firstWord}</span>
      {restTitle ? (
        <>
          <span className="hidden sm:inline"> </span>
          <span className="block sm:inline">{restTitle}</span>
        </>
      ) : null}
    </div>
  );
}

function RuleSkeleton({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-[118px] flex-col overflow-hidden rounded-[22px] bg-zinc-950/80 px-3 py-3 shadow-[inset_0_0_36px_rgba(161,161,170,0.08),inset_0_1px_0_rgba(244,244,245,0.04)] ring-1 ring-zinc-900 sm:min-h-[166px] sm:rounded-[26px] sm:px-5 sm:py-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(161,161,170,0.12),transparent_56%),radial-gradient(circle_at_50%_100%,rgba(39,39,42,0.28),transparent_62%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px rounded-[21px] shadow-[inset_0_0_24px_rgba(212,212,216,0.06)] sm:rounded-[25px]"
      />

      <div className="relative flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <MobileTwoLineRuleTitle
            title={label}
            className="text-[14px] font-medium leading-tight text-zinc-500 sm:text-[17px]"
          />

          <SkeletonBlock className="mt-2 hidden h-[34px] w-40 sm:block" />
        </div>

        <div className="min-w-0 max-w-[60%] shrink-0 pt-0.5 text-right sm:hidden">
          <SkeletonBlock className="ml-auto h-5 w-24" />
        </div>
      </div>

      <div className="relative mt-auto pt-3 sm:pt-2">
        <LossRuleBarsSkeleton />
      </div>
    </div>
  );
}

function PositionsSegmentedControlSkeleton() {
  return (
    <div className="mb-3 flex items-center">
      <div className="relative z-20 inline-flex h-10 w-fit items-center rounded-lg bg-zinc-900/70">
        <div className="relative flex h-10 min-w-[62px] items-center justify-center rounded-lg px-3.5 text-[13px] font-medium text-zinc-100">
          <span className="absolute inset-0 m-[3px] rounded-lg bg-zinc-800" />
          <span className="relative z-10">Open</span>
        </div>

        <div className="relative flex h-10 min-w-[62px] items-center justify-center rounded-lg px-3.5 text-[13px] font-medium text-zinc-300">
          Past
        </div>
      </div>
    </div>
  );
}

function TableHeader({ labels }: { labels: string[] }) {
  return (
    <div className="hidden min-w-[640px] grid-cols-[minmax(220px,1fr)_86px_86px_104px_116px] border-b border-zinc-900 bg-black/20 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:grid lg:px-5">
      {labels.map((label, index) => (
        <div key={label} className={index >= 2 ? "text-right" : "text-left"}>
          {label}
        </div>
      ))}
    </div>
  );
}

function getSkeletonRowClassName(index: number) {
  const tint =
    index % 3 === 0
      ? "bg-zinc-950/80"
      : index % 3 === 1
        ? "bg-zinc-900/35"
        : "bg-zinc-900/20";

  return [
    "border-b border-zinc-900/80 px-3 py-4 text-sm last:border-b-0 sm:px-5 sm:py-3.5 lg:py-3",
    tint,
  ].join(" ");
}

function PositionSkeletonRow({ index }: { index: number }) {
  return (
    <div className={getSkeletonRowClassName(index)}>
      <div className="lg:hidden">
        <div className="flex min-w-0 items-start gap-3.5">
          <SkeletonBlock className="h-11 w-11 shrink-0 rounded-lg lg:h-9 lg:w-9" />

          <div className="min-w-0 flex-1 pr-2">
            <SkeletonBlock className="h-6 w-36" />
            <SkeletonBlock className="mt-1 h-5 w-32" />
          </div>

          <SkeletonBlock className="mt-0.5 h-6 w-16 shrink-0" />
        </div>

        <div className="mt-3 flex justify-end pl-[58px]">
          <div className="grid w-full max-w-[274px] grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(96px,1.15fr)] gap-2.5 text-right">
            <div>
              <SkeletonBlock className="ml-auto h-3.5 w-14" />
              <SkeletonBlock className="ml-auto mt-2 h-6 w-16" />
            </div>
            <div>
              <SkeletonBlock className="ml-auto h-3.5 w-14" />
              <SkeletonBlock className="ml-auto mt-2 h-6 w-[70px]" />
            </div>
            <div>
              <SkeletonBlock className="ml-auto h-3.5 w-14" />
              <SkeletonBlock className="ml-auto mt-2 h-6 w-[92px]" />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden min-w-[640px] grid-cols-[minmax(220px,1fr)_86px_86px_104px_116px] items-center lg:grid">
        <div className="flex min-w-0 items-center gap-3">
          <SkeletonBlock className="h-9 w-9 rounded-lg" />
          <div className="min-w-0">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-2 h-3 w-12" />
          </div>
        </div>

        <SkeletonBlock className="h-5 w-16 rounded-full" />
        <SkeletonBlock className="ml-auto h-4 w-12" />
        <SkeletonBlock className="ml-auto h-4 w-14" />
        <SkeletonBlock className="ml-auto h-4 w-16" />
      </div>
    </div>
  );
}

function PositionsTableSkeleton() {
  return (
    <div>
      <PositionsSegmentedControlSkeleton />

      <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/80 shadow-sm lg:overflow-x-auto">
        <TableHeader labels={["Team", "Status", "Odds", "Stake", "Payout"]} />
        {[0, 1, 2].map((index) => (
          <PositionSkeletonRow key={`position-skeleton-${index}`} index={index} />
        ))}
      </div>
    </div>
  );
}

export default function LoadingAccountPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pt-20 pb-32 sm:px-6 md:py-15 md:pb-24">
        <section>
          <div className="grid items-stretch gap-3 lg:grid-cols-2">
            <TopSummarySkeleton />
            <GoalSkeleton />
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-0 lg:gap-3">
          <div className="pr-1.5 lg:pr-0">
            <RuleSkeleton label="Daily loss" />
          </div>

          <div className="pl-1.5 lg:pl-0">
            <RuleSkeleton label="Total loss" />
          </div>
        </section>

        <section className="mt-10">
          <PositionsTableSkeleton />
        </section>

        <section className="mt-10 min-h-[72px] rounded-[24px] bg-zinc-950/70 p-4 ring-1 ring-zinc-900">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">
            Account ID
          </div>

          <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        </section>
      </div>
    </div>
  );
}