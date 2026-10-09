import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the club page (SPEC §13.4: skeletons): title, member rows, invitation. */
export default function ClubPageLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter klubben …</span>
      <Skeleton className="h-10 w-2/3 max-w-sm md:h-12" />
      <Skeleton className="mt-3 mb-6 h-5 w-56 max-w-full md:mb-8" />

      <Skeleton className="mb-4 h-7 w-36" />
      <div className="divide-y divide-border rounded-2xl border border-border bg-paper px-4 sm:px-5">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex min-h-18 items-center gap-3 py-3 sm:gap-4">
            <Skeleton className="m-1 size-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="mt-2 h-4 w-52 max-w-full" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="mt-12 mb-4 h-7 w-56" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
