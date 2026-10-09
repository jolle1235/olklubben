import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { CalendarView } from "./calendar-params";

const GRID_WEEKS = 5;

export type CalendarSkeletonProps = {
  /** The URL's ?view (null = none: the responsive default). */
  view: CalendarView | null;
};

/**
 * Kalender while it loads (SPEC §13.4): the title, the view toggle and the
 * view the page will show, so the layout does not jump. It follows ?view like
 * the page (D-078): "list" → list cards and "month" → the month grid at every
 * width; without ?view the page's responsive pair, list cards below md and
 * the month grid from md.
 */
export function CalendarSkeleton({ view }: CalendarSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter kalenderen …</span>
      <Skeleton className="mb-6 h-10 w-48 md:mb-8 md:h-12" />
      <Skeleton className="mb-5 h-13 w-56 rounded-xl md:mb-6" />

      {view !== "month" ? <ListSkeleton className={cn(view === null && "md:hidden")} /> : null}
      {view !== "list" ? (
        <MonthSkeleton className={cn(view === null && "hidden md:block")} />
      ) : null}
    </div>
  );
}

/**
 * Upcoming events as cards (<CalendarList />), then the quieter "Tidligere
 * ølsmagninger" (<CalendarHistory />).
 */
function ListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-10 md:gap-12", className)}>
      <CardsSkeleton cards={3} className="bg-paper" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 max-w-full" />
        <CardsSkeleton cards={2} withMeta className="bg-cream-deep/50" />
      </div>
    </div>
  );
}

function CardsSkeleton({
  cards,
  withMeta = false,
  className,
}: {
  cards: number;
  withMeta?: boolean;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="mb-1 h-5 w-36" />
      {Array.from({ length: cards }, (_, card) => (
        <div
          key={card}
          className={cn(
            "flex min-h-20 items-center gap-4 rounded-xl border border-border px-4 py-3",
            className,
          )}
        >
          <div className="flex w-11 flex-col items-center gap-2">
            <Skeleton className="h-8 w-9" />
            <Skeleton className="h-3 w-7" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            {withMeta ? <Skeleton className="h-4 w-1/2" /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The month grid (<CalendarMonth />): below md compact date cells and the day
 * panel under them, from md a bordered grid with room for event chips.
 */
function MonthSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
        <Skeleton className="h-7 w-40 md:h-9 md:w-52" />
        <Skeleton className="h-11 w-24 md:w-44" />
      </div>
      <div className="grid grid-cols-7 md:overflow-hidden md:rounded-xl md:border md:border-border md:bg-paper">
        {Array.from({ length: 7 * GRID_WEEKS }, (_, cell) => (
          <div
            key={cell}
            className="grid h-12 place-items-center p-0.5 nth-[7n+1]:border-l-0 md:block md:h-auto md:min-h-24 md:border-t md:border-l md:border-border md:p-1.5"
          >
            <Skeleton className="size-7 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-32 rounded-xl md:hidden" />
    </div>
  );
}
