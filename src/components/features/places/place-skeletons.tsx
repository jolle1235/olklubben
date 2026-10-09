import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading states shaped like the place pages (SPEC §13.4.7: skeletons, not
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

/** The PageHeader: title, maybe a line, and its action button ("always", or from md like the page). */
function TitleSkeleton({
  withLine = true,
  action,
}: {
  withLine?: boolean;
  action?: "always" | "desktop";
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
      <div className="min-w-0 flex-1 basis-64">
        <Skeleton className="h-10 w-2/5 max-w-xs md:h-12" />
        {withLine ? <Skeleton className="mt-3 h-5 w-full max-w-md" /> : null}
      </div>
      {action ? (
        <Skeleton className={action === "always" ? "h-11 w-44" : "hidden h-11 w-32 md:block"} />
      ) : null}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-paper px-4 py-3.5 sm:gap-4 sm:px-5">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-2/5" />
      </div>
    </div>
  );
}

/** Steder: title + description and a few cards. */
export function PlacesListSkeleton() {
  return (
    <Busy label="Henter stederne …">
      <TitleSkeleton action="desktop" />
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </Busy>
  );
}

/** One place: title, address + button, owners, and the list of tastings. */
export function PlaceDetailSkeleton() {
  return (
    <Busy label="Henter stedet …">
      {/* "Alle steder" */}
      <div className="mb-1 flex min-h-11 items-center">
        <Skeleton className="h-5 w-28" />
      </div>
      <TitleSkeleton withLine={false} action="always" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="grid content-start gap-8">
          <div className="grid gap-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-11 w-36" />
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-5 w-full" />
            <div className="grid gap-3 rounded-2xl border border-border bg-paper p-4">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-5 flex-1" />
                </div>
              ))}
            </div>
            <Skeleton className="h-11 w-44" />
          </div>
        </div>
        <div className="grid content-start gap-3">
          <Skeleton className="h-7 w-48" />
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex min-h-16 items-center gap-4 bg-card px-4 py-3">
                <Skeleton className="h-6 w-14" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** Nyt sted: title and the form's fields inside a card. */
export function PlaceFormSkeleton() {
  return (
    <Busy label="Henter formularen …">
      <TitleSkeleton />
      <div className="grid max-w-2xl gap-6 rounded-xl border border-border bg-card p-5">
        {["h-11", "h-11", "h-24"].map((height, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className={height} />
          </div>
        ))}
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-13 w-full sm:w-40" />
      </div>
    </Busy>
  );
}
