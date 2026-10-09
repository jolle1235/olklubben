import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { calendarHistoryHref } from "@/components/features/calendar/calendar-params";
import type { PastCalendarEvent } from "@/components/features/calendar/event-format";
import { EventListItem } from "@/components/features/calendar/event-list-item";
import { Button } from "@/components/ui/button";
import { pastEventMetaDisplay } from "@/server/domain/events/history";

export type PastEventsProps = {
  clubId: string;
  /** The newest past tastings (listPastEvents with OVERVIEW_HISTORY_LIMIT), newest first. */
  events: PastCalendarEvent[];
  now: Date;
};

/**
 * "Tidligere ølsmagninger" on Overblik (SPEC §9.1, §13.4.2, D-107): the
 * newest few tastings as quiet rows with what was drunk ("4 øl · Bedst:
 * Westmalle Tripel ★ 4,7"), then "Se alle tidligere" to the calendar's
 * history. Below the upcoming events and secondary to them: no button
 * competes with the page's primary action. Nothing when there is no history.
 */
export function PastEvents({ clubId, events, now }: PastEventsProps) {
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="past-events-heading">
      <h2
        id="past-events-heading"
        className="mb-3 text-2xl leading-tight font-bold text-olive md:text-[1.75rem]"
      >
        Tidligere ølsmagninger
      </h2>
      <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-cream-deep/40">
        {events.map((event) => (
          <li key={event.id} className="first:*:rounded-t-xl last:*:rounded-b-xl">
            <EventListItem
              clubId={clubId}
              event={event}
              now={now}
              meta={pastEventMetaDisplay(event)}
              muted
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex sm:justify-end">
        <Button asChild variant="link" className="min-h-11 px-0">
          <Link href={calendarHistoryHref(clubId)}>
            Se alle tidligere
            <ArrowRightIcon aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
