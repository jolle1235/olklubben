import { Skeleton } from "@/components/ui/skeleton";

/**
 * Overblik while it loads (SPEC §13.4: skeletons, not spinners), shaped like
 * the page: the harbor hero card (label, badge, big date, title, lines,
 * button) and the "Kommende arrangementer" rows. Announced once as "Henter
 * Overblik …".
 */
export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8 md:gap-10">
      <span className="sr-only">Henter Overblik …</span>

      <div className="rounded-2xl on-harbor px-5 pt-5 pb-6 sm:px-7 md:px-10 md:pt-8 md:pb-10">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-40 bg-harbor-soft" />
          <Skeleton className="h-8 w-24 rounded-full bg-harbor-soft" />
        </div>
        <div className="mt-5 grid gap-5 md:mt-7 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-10">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-18 w-24 bg-harbor-soft md:h-24 md:w-28" />
            <Skeleton className="h-4 w-24 bg-harbor-soft" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-4/5 max-w-sm bg-harbor-soft" />
            <Skeleton className="h-5 w-40 bg-harbor-soft" />
            <Skeleton className="h-5 w-32 bg-harbor-soft" />
            <Skeleton className="mt-3 h-13 w-full bg-harbor-soft sm:w-40" />
          </div>
        </div>
      </div>

      <div>
        <Skeleton className="mb-3 h-8 w-64 max-w-full" />
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-16 items-center gap-4 px-4 py-3 md:px-5">
              <Skeleton className="h-6 w-12" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
