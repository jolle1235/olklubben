import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading states shaped like the feedback pages (SPEC §13.4.7: skeletons, not
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

function TitleSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
      <div className="min-w-0 flex-1 basis-64">
        <Skeleton className="h-10 w-2/5 max-w-xs md:h-12" />
        <Skeleton className="mt-3 h-5 w-full max-w-md" />
      </div>
      {action ? <Skeleton className="h-11 w-40" /> : null}
    </div>
  );
}

function ChipRow({ chips }: { chips: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-5 w-14" />
      {Array.from({ length: chips }, (_, index) => (
        <Skeleton key={index} className="h-11 w-24 rounded-full" />
      ))}
    </div>
  );
}

/** /feedback: title + "Ny rapport", the filters and a few cards. */
export function FeedbackListSkeleton() {
  return (
    <Busy label="Henter rapporterne …">
      <TitleSkeleton action />
      <div className="mb-6 grid grid-cols-1 gap-3 md:mb-8">
        <ChipRow chips={3} />
        <ChipRow chips={3} />
        <ChipRow chips={2} />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-xl border border-border bg-paper px-4 py-3.5 sm:gap-4 sm:px-5"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** One report: back link, title, meta, the description and the 👍. */
export function FeedbackDetailSkeleton() {
  return (
    <Busy label="Henter rapporten …">
      <div className="mb-1 flex min-h-11 items-center">
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="mb-6 h-10 w-3/4 max-w-lg md:mb-8 md:h-12" />
      <div className="grid max-w-2xl grid-cols-1 gap-6">
        <div className="grid gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="grid gap-2 rounded-xl border border-border bg-paper p-5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-11 w-60" />
        </div>
      </div>
    </Busy>
  );
}

/** Ny rapport: title and the form's fields inside a card. */
export function FeedbackFormSkeleton() {
  return (
    <Busy label="Henter formularen …">
      <TitleSkeleton />
      <div className="grid max-w-2xl gap-6 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-2">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
        {["h-11", "h-36", "h-11"].map((height, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className={height} />
          </div>
        ))}
        <Skeleton className="h-13 w-full sm:w-32" />
      </div>
    </Busy>
  );
}
