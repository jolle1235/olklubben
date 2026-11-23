import { SETTINGS_LIST } from "@/components/features/profile/settings-lists";
import { Skeleton } from "@/components/ui/skeleton";

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-2">
      <Skeleton className="ml-1 h-3 w-24" />
      <div className={SETTINGS_LIST}>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex min-h-16 items-center gap-4 px-4 py-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3.5 w-28 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading state for Indstillinger, shaped like the page (SPEC §13.4). */
export default function SettingsLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter …</span>
      <Skeleton className="mb-header h-8 w-48 max-md:hidden md:h-12" />
      <div className="flex flex-col gap-section">
        <GroupSkeleton rows={1} />
        <GroupSkeleton rows={2} />
        <GroupSkeleton rows={2} />
        <GroupSkeleton rows={3} />
      </div>
    </div>
  );
}
