import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { calendarHref } from "@/components/features/calendar/calendar-params";
import type { CalendarEvent } from "@/components/features/calendar/event-format";
import { EventListItem } from "@/components/features/calendar/event-list-item";
import { Button } from "@/components/ui/button";

import { PlanActions } from "./no-events-state";

export type UpcomingEventsProps = {
  clubId: string;
  /** The events after the hero, oldest first (already capped). */
  events: CalendarEvent[];
  now: Date;
  newEventHref: string;
  newPollHref: string;
};

/**
 * "Kommende arrangementer" under the hero on Overblik (SPEC §9.1): the next
 * few events as compact rows, then [+ Opret event] and a way to the full
 * calendar. Secondary to the hero, so the buttons are outline/link (§13.4).
 * [🗳 Planlæg ølsmagning] sits next to [+ Opret event] (round 4, D-137).
 */
export function UpcomingEvents({
  clubId,
  events,
  now,
  newEventHref,
  newPollHref,
}: UpcomingEventsProps) {
  return (
    <section aria-labelledby="upcoming-events-heading">
      <h2
        id="upcoming-events-heading"
        className="mb-3 text-2xl leading-tight font-bold text-olive md:text-[1.75rem]"
      >
        Kommende arrangementer
      </h2>

      {events.length > 0 ? (
        <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {events.map((event) => (
            <li key={event.id} className="first:*:rounded-t-xl last:*:rounded-b-xl">
              <EventListItem clubId={clubId} event={event} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border-2 border-dashed border-border bg-paper/60 px-4 py-4 text-[1.05rem] text-muted-foreground md:px-5">
          Ikke flere ølsmagninger i kalenderen endnu.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PlanActions
          newEventHref={newEventHref}
          newPollHref={newPollHref}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
        />
        <Button asChild variant="link" className="min-h-11 self-center">
          <Link href={calendarHref(clubId, { view: "list" })}>
            Se hele kalenderen
            <ArrowRightIcon aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
