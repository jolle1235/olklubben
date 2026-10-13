import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading states shaped like the songbook pages (SPEC §13.4.7: skeletons,
 * not spinners), so nothing jumps when the content arrives.
 */

function Busy({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Sangbog: title, the finder bar, one letter heading and a card of rows. */
export function SongListSkeleton() {
  return (
    <Busy label="Henter sangbogen …">
      <div className="mb-6 md:mb-8">
        <Skeleton className="h-10 w-48 md:h-12" />
        <Skeleton className="mt-3 h-5 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:max-w-2xl">
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 w-11" />
        </div>
        <Skeleton className="mt-2 h-7 w-8" />
        <div className="grid grid-cols-1 divide-y divide-cream-deep rounded-2xl border border-border bg-paper">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="grid min-h-15 content-center gap-1.5 px-4 py-2.5">
              <Skeleton className={index % 3 === 1 ? "h-5 w-3/5" : "h-5 w-2/5"} />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** One song: back link, title, artist, the toolbar and three stanzas. */
export function SongReaderSkeleton() {
  return (
    <Busy label="Henter sangen …">
      <Skeleton className="mb-4 h-6 w-24" />
      <Skeleton className="h-10 w-3/4 max-w-md md:h-12" />
      <Skeleton className="mt-3 h-5 w-36" />
      <Skeleton className="mt-6 h-11 w-48" />
      <div className="mt-8 grid max-w-[40rem] gap-7">
        {[4, 3, 4].map((lines, stanza) => (
          <div key={stanza} className="grid gap-2.5">
            {Array.from({ length: lines }, (_, line) => (
              <Skeleton key={line} className={line % 2 === 0 ? "h-6 w-4/5" : "h-6 w-3/5"} />
            ))}
          </div>
        ))}
      </div>
    </Busy>
  );
}
