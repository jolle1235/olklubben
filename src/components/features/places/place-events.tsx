import type { CalendarEvent } from "@/components/features/calendar/event-format";
import { EventListItem } from "@/components/features/calendar/event-list-item";
import { hasEnded } from "@/server/domain/events/status";

export type PlaceEventsProps = {
  clubId: string;
  /** The events at the place, newest first (listEventsAtPlace). */
  events: CalendarEvent[];
  now: Date;
};

/**
 * "Ølsmagninger her (N)" on a place (SPEC §9.4, D-107): every event at the
 * place, newest first, as the calendar's compact rows (EventListItem); the
 * tastings that are over are muted, like the history elsewhere (D-078). The
 * rows show weekday and time instead of repeating the place's name.
 */
export function PlaceEvents({ clubId, events, now }: PlaceEventsProps) {
  return (
    <section aria-labelledby="place-events-heading" className="grid grid-cols-1 gap-3">
      <h2 id="place-events-heading" className="text-2xl text-olive">
        Ølsmagninger her
        {events.length > 0 ? (
          <span className="ml-2 font-sans text-lg font-normal text-muted-foreground">
            ({events.length})
          </span>
        ) : null}
      </h2>
      {events.length > 0 ? (
        <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {events.map((event) => (
            <li key={event.id} className="first:*:rounded-t-xl last:*:rounded-b-xl">
              <EventListItem
                clubId={clubId}
                event={event}
                now={now}
                muted={hasEnded(event, now)}
                showPlace={false}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border-2 border-dashed border-border bg-paper/60 px-4 py-4 text-[1.05rem] text-muted-foreground md:px-5">
          Ingen ølsmagninger her endnu.
        </p>
      )}
    </section>
  );
}
