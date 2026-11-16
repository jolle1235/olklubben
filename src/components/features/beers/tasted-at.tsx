import { CalendarDaysIcon } from "lucide-react";

import { LinkRow } from "@/components/features/link-row";
import { formatCompactDate, toDateKey } from "@/lib/format/date";
import { eventHref } from "@/lib/routes";
import type { BeerEventRef } from "@/server/beers/queries";

export type TastedAtProps = {
  clubId: string;
  event: BeerEventRef | null;
};

/**
 * "Smagt til" on the beer page (SPEC §9.5): "Ølsmagning #12 · 14. sep 2026"
 * as a link to the event, or "Ikke knyttet til et event". The next beer of
 * the same tasting is added from the event page (§10.5, D-179).
 */
export function TastedAt({ clubId, event }: TastedAtProps) {
  return (
    <section
      aria-labelledby="tasted-at-heading"
      className="grid grid-cols-1 content-start gap-3 self-start"
    >
      <h2 id="tasted-at-heading" className="text-title-md text-primary-ink">
        Smagt til
      </h2>
      {event ? (
        <LinkRow
          href={eventHref(clubId, event.id)}
          icon={CalendarDaysIcon}
          title={<span className="break-words hyphens-auto">{event.title}</span>}
          subtitle={
            <time dateTime={toDateKey(event.startsAt)}>{formatCompactDate(event.startsAt)}</time>
          }
          className="pressable rounded-xl border border-border bg-card md:px-5"
        />
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card-faint px-4 py-4 text-muted-foreground">
          Ikke knyttet til et event
        </p>
      )}
    </section>
  );
}
