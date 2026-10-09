import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for Profil, shaped like the page (SPEC §13.4). */
export default function ProfileLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter …</span>
      <Skeleton className="mb-6 h-10 w-40 md:mb-8 md:h-12" />
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Skeleton className="m-1.5 size-24 shrink-0 rounded-full" />
          <div className="flex w-full flex-col items-center gap-2 sm:items-start">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full sm:w-32" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}
