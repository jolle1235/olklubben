import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic loading state for a club page (SPEC §13.4: skeletons, not
 * spinners): a page title and a large panel, like Overblik's empty state and
 * the placeholders. Used by the loading.tsx files under c/[clubId]; feature
 * pages may replace it with a skeleton shaped like their own content.
 *
 * Where a loading.tsx may live: only above pages that never call notFound()
 * themselves (TG-008). See the route notes in src/app/c/[clubId]/layout.tsx.
 */
export function PageSkeleton({ label = "Henter …" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="mb-6 h-10 w-3/4 max-w-md md:mb-8 md:h-12" />
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-paper/60 px-6 py-10 md:py-12">
        <Skeleton className="mb-6 size-16 rounded-full" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        <Skeleton className="mt-6 h-13 w-full rounded-lg sm:w-44" />
      </div>
    </div>
  );
}
