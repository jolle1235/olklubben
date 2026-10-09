import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading states shaped like the beer pages (SPEC §13.4.7: skeletons, not
 * spinners), so nothing jumps when the content arrives.
 */

function Busy({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function TitleSkeleton({ withLine = true }: { withLine?: boolean }) {
  return (
    <div className="mb-6 md:mb-8">
      <Skeleton className="h-10 w-3/5 max-w-sm md:h-12" />
      {withLine ? <Skeleton className="mt-3 h-5 w-32" /> : null}
    </div>
  );
}

/** Ølkatalog: title, search + two selects, and a few cards. */
export function BeerCatalogSkeleton() {
  return (
    <Busy label="Henter ølkataloget …">
      <TitleSkeleton />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem] md:items-end">
        <Skeleton className="h-11" />
        <div className="grid grid-cols-2 gap-3 md:contents">
          <Skeleton className="h-[4.4rem] md:h-11" />
          <Skeleton className="h-[4.4rem] md:h-11" />
        </div>
      </div>
      <Skeleton className="mt-5 mb-3 h-5 w-16" />
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-xl border border-border bg-paper px-4 py-3.5 sm:gap-4 sm:px-5"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="flex justify-between gap-3">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Øl-detail: title, the two rating panels and the ratings list. */
export function BeerDetailSkeleton() {
  return (
    <Busy label="Henter øllen …">
      <TitleSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 rounded-2xl bg-harbor/15" />
        <div className="grid content-start gap-3 rounded-2xl border border-border bg-paper p-5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-14 w-72 max-w-full" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <Skeleton className="mt-8 mb-3 h-7 w-28" />
      <div className="grid gap-3 rounded-2xl border border-border bg-paper p-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Tilføj øl: title and three fields. */
export function BeerFormSkeleton() {
  return (
    <Busy label="Henter …">
      <TitleSkeleton />
      <div className="grid max-w-xl gap-5">
        {[true, false, true].map((wide, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className={wide ? "h-11" : "h-11 sm:max-w-48"} />
          </div>
        ))}
        <Skeleton className="h-13 w-full sm:w-40" />
      </div>
    </Busy>
  );
}
