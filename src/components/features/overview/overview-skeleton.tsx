import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Overblik while it loads (SPEC §13.4: skeletons, not spinners), shaped like
 * the page: the feature hero card (label, badge, big date, title, lines,
 * button), a dashed poll card (round 4: polls sit right under the hero), the
 * "Kommende arrangementer" rows and the quieter "Tidligere
 * ølsmagninger" rows. Announced once as "Henter Overblik …".
 */
export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-section-loose">
      <span className="sr-only">Henter Overblik …</span>

      <div className="rounded-2xl surface-feature p-4 sm:px-7 md:px-10 md:pt-8 md:pb-10">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-40 bg-feature-hover" />
          <Skeleton className="h-8 w-24 rounded-full bg-feature-hover" />
        </div>
        {/* Mobile: date beside title, time and place, the button under both (NextEventHero). */}
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 md:mt-7 md:items-center md:gap-x-10">
          <div className="flex flex-col gap-2 md:row-span-2 md:gap-3">
            <Skeleton className="h-12 w-14 bg-feature-hover md:h-24 md:w-28" />
            <Skeleton className="h-3 w-20 bg-feature-hover md:h-4 md:w-24" />
          </div>
          <div className="flex flex-col gap-2 md:gap-3">
            <Skeleton className="h-6 w-4/5 max-w-sm bg-feature-hover md:h-10" />
            <Skeleton className="h-5 w-36 bg-feature-hover md:w-40" />
            <Skeleton className="h-5 w-28 bg-feature-hover md:w-32" />
          </div>
          <Skeleton className="col-span-2 mt-4 h-11 w-full bg-feature-hover md:col-span-1 md:col-start-2 md:mt-6 md:h-13 md:w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border-2 border-dashed border-info-border bg-card px-5 py-4 sm:px-6 sm:py-5">
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="h-6 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-11 w-full sm:w-32" />
      </div>

      <RowsSkeleton rows={3} className="bg-card" />
      <RowsSkeleton rows={2} withMeta className="bg-muted-faint" />
    </div>
  );
}

/** A heading and a bordered list of event rows (EventListItem). */
function RowsSkeleton({
  rows,
  withMeta = false,
  className,
}: {
  rows: number;
  withMeta?: boolean;
  className: string;
}) {
  return (
    <div>
      <Skeleton className="mb-3 h-8 w-64 max-w-full" />
      <div
        className={cn(
          "divide-y divide-border overflow-hidden rounded-xl border border-border",
          className,
        )}
      >
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex min-h-16 items-center gap-4 px-4 py-3 md:px-5">
            <Skeleton className="h-6 w-12" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              {withMeta ? <Skeleton className="h-4 w-2/5" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
