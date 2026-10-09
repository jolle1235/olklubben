import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading states for the event pages (SPEC §13.4.7: skeletons, not spinners),
 * shaped like the content so nothing jumps when it arrives.
 */

export function EventDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto flex max-w-2xl flex-col gap-8">
      <span className="sr-only">Henter eventet …</span>
      <div className="flex flex-col items-center rounded-3xl border border-border bg-paper px-5 pt-8 pb-6 sm:px-10 sm:pt-10">
        <Skeleton className="mb-5 size-12 rounded-full" />
        <Skeleton className="mb-3 h-6 w-24 rounded-full" />
        <Skeleton className="h-10 w-64 max-w-full md:h-12" />
        <Skeleton className="mt-4 h-9 w-48 rounded-2xl" />
        <Skeleton className="my-7 h-3 w-full" />
        <Skeleton className="h-20 w-20 md:h-24" />
        <Skeleton className="mt-3 h-4 w-24" />
        <Skeleton className="mt-5 h-7 w-56 max-w-full" />
        <Skeleton className="mt-2 h-7 w-28" />
        <Skeleton className="my-7 h-3 w-full" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-5 w-48 max-w-full" />
        <Skeleton className="mt-4 h-11 w-36" />
        <Skeleton className="mt-7 h-px w-full" />
        <Skeleton className="mt-4 h-9 w-52 max-w-full" />
        <Skeleton className="mt-2 h-4 w-36" />
      </div>
      <div className="grid gap-5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mx-auto h-8 w-64 max-w-full" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Opret/Rediger event: title, the time row, the place cards, the host chips,
 * theme, plan and the button – the form's order (SPEC §9.2).
 */
export function EventFormSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="max-w-2xl">
      <span className="sr-only">Henter …</span>
      <Skeleton className="mb-6 h-10 w-56 md:mb-8 md:h-12" />
      <div className="grid gap-7 rounded-xl border border-border bg-paper p-5">
        <FieldSkeleton />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <FieldSkeleton className="col-span-2 sm:col-span-1" />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <ChoicesSkeleton count={4} itemClassName="h-16" />
        <ChoicesSkeleton count={2} itemClassName="h-13" />
        <FieldSkeleton />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-13 w-full sm:w-44" />
      </div>
    </div>
  );
}

function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

function ChoicesSkeleton({ count, itemClassName }: { count: number; itemClassName: string }) {
  return (
    <div className="grid gap-2">
      <Skeleton className="mb-1 h-4 w-20" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} className={cn("w-full rounded-xl", itemClassName)} />
        ))}
      </div>
    </div>
  );
}
