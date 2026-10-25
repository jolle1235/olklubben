import { SectionDivider } from "@/components/ui/section-divider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the club page (SPEC §13.4: skeletons): title, member rows,
 * the "Steder" row, the invitation card and Farezone, split by thin lines. In the (members) group so it
 * does not wrap club/edit, which 404s for non-admins and must stay a real 404
 * (TG-008, D-108).
 */
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

      <SectionDivider className="my-8 md:my-10" />
      <Skeleton className="mb-4 h-7 w-24" />
      <Skeleton className="h-16 w-full rounded-2xl" />

      <SectionDivider className="my-8 md:my-10" />
      <Skeleton className="h-96 w-full rounded-xl" />

      <SectionDivider className="my-8 md:my-10" />
      <Skeleton className="mb-4 h-7 w-32" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}
