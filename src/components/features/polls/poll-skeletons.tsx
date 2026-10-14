import { Skeleton } from "@/components/ui/skeleton";

/**
 * STUB (round 4 foundation). OWNER: P1. Exports are frozen (contract §9).
 *
 * Loading states for the poll pages (SPEC §13.4.7: skeletons, not spinners).
 * PollPageSkeleton: polls/[pollId]/(detail)/loading.tsx. PollFormSkeleton:
 * polls/new/loading.tsx (it includes the page header's h1 placeholder).
 */

export function PollPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-2xl flex-col gap-8"
    >
      <span className="sr-only">Henter afstemningen …</span>
      <div className="grid gap-3">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-56 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export function PollFormSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="max-w-2xl">
      <span className="sr-only">Henter …</span>
      <Skeleton className="mb-6 h-10 w-64 max-w-full md:mb-8 md:h-12" />
      <div className="grid gap-7 rounded-xl border border-border bg-paper p-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-13 w-full sm:w-48" />
      </div>
    </div>
  );
}
