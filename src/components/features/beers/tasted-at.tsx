import Link from "next/link";
import { CalendarDaysIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { formatCompactDate, toDateKey } from "@/lib/format/date";
import { eventHref } from "@/lib/routes";
import type { BeerEventRef } from "@/server/beers/queries";

export type TastedAtProps = {
  clubId: string;
  event: BeerEventRef | null;
  /** "Tilføj en øl mere" to the same event; null hides it. */
  newBeerHref: string | null;
};

/**
 * "Smagt til" on the beer page (SPEC §9.5): "Ølsmagning #12 · 14. sep 2026"
 * as a link to the event, or "Ikke knyttet til et event". Below it a shortcut
 * to add the next beer of the same tasting (§10.5).
 */
export function TastedAt({ clubId, event, newBeerHref }: TastedAtProps) {
  return (
    <section aria-labelledby="tasted-at-heading" className="grid grid-cols-1 gap-3">
      <h2 id="tasted-at-heading" className="text-2xl text-olive">
        Smagt til
      </h2>
      {event ? (
        <Link
          href={eventHref(clubId, event.id)}
          className="group/event flex min-h-16 items-center gap-4 rounded-xl border border-border bg-paper px-4 py-3 transition-colors hover:bg-cream-deep/70 md:px-5"
        >
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-olive text-amber [&_svg]:size-5"
          >
            <CalendarDaysIcon strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg leading-tight font-semibold break-words hyphens-auto text-olive">
              {event.title}
            </span>
            <time
              dateTime={toDateKey(event.startsAt)}
              className="text-[0.95rem] text-muted-foreground"
            >
              {formatCompactDate(event.startsAt)}
            </time>
          </span>
          <ChevronRightIcon
            aria-hidden
            className="size-5 shrink-0 text-slate transition-transform group-hover/event:translate-x-0.5"
          />
        </Link>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-paper/60 px-4 py-4 text-muted-foreground">
          Ikke knyttet til et event
        </p>
      )}
      {newBeerHref ? (
        <Link
          href={newBeerHref}
          className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
        >
          <PlusIcon aria-hidden className="size-4" />
          Tilføj en øl mere til eventet
        </Link>
      ) : null}
    </section>
  );
}
