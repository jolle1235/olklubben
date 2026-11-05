import { eventHref } from "@/lib/routes";
import {
  hasEnded,
  heroState,
  heroStateLabel,
  isHeroHighlighted,
} from "@/server/domain/events/status";

import { DateCard } from "./date-card";
import { eventPlaceAndTime, type CalendarEvent } from "./event-format";

export type EventCardProps = {
  clubId: string;
  event: CalendarEvent;
  /** The request's time: past events are muted, today's get a badge. */
  now: Date;
  /** An extra line, e.g. "4 øl · Bedst: Westmalle Tripel ★ 4,7" (the history section). */
  meta?: string | null;
  className?: string;
};

/**
 * A confirmed event as a big, readable card (SPEC §9.3 list view, §13.4):
 * the day number and short weekday on the left, title, "Hos Mads · 18:30" and
 * the theme on the right. Filled card with a primary accent (§9.3 "Bekræftet
 * event"); a past event is muted, today's and an ongoing one get "I aften! 🍻"
 * / "I gang nu". The whole card links to the event.
 *
 * Server-safe and client-safe (used by the calendar's day panel too).
 */
export function EventCard({ clubId, event, now, meta, className }: EventCardProps) {
  const past = hasEnded(event, now);
  const state = heroState(event, now);
  const badge = !past && isHeroHighlighted(state) ? heroStateLabel(state) : null;

  return (
    <DateCard
      href={eventHref(clubId, event.id)}
      variant={past ? "past" : "event"}
      date={event.startsAt}
      now={now}
      title={event.title}
      badge={badge}
      className={className}
    >
      <span className="block text-body-sm break-words text-muted-foreground">
        {eventPlaceAndTime(event)}
      </span>
      {event.theme ? (
        <span className="mt-0.5 block text-body-sm break-words text-foreground">
          <span className="text-muted-foreground">Tema:</span> {event.theme}
        </span>
      ) : null}
      {meta ? (
        <span className="mt-0.5 block text-body-sm break-words hyphens-auto text-foreground">
          {meta}
        </span>
      ) : null}
    </DateCard>
  );
}
