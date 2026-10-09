import { formatLongDate, formatTimeRange, formatWeekday } from "@/lib/format/date";
import { zonedDateTimeToUtc, type DateKey } from "@/server/domain/events/time";

/**
 * Texts for events on Overblik and in the calendar (SPEC §9.1, §9.3), built
 * on the shared Copenhagen formatters (src/lib/format/date.ts, D-039), so
 * server and browser render the same strings.
 *
 * Pure module: client-safe (the calendar's day panel is a Client Component).
 */

/** What Overblik and the calendar show of an event (EventSummary fits). */
export type CalendarEvent = {
  id: string;
  title: string;
  theme: string | null;
  /** Where (EventPlace from src/server/events/queries.ts fits). */
  place: { name: string };
  startsAt: Date;
  endsAt: Date | null;
};

/** A past tasting in the history (PastEventSummary from src/server/events/queries.ts fits). */
export type PastCalendarEvent = CalendarEvent & {
  beerCount: number;
  /** The evening's best-rated beer, null when nothing was rated. */
  topBeer: { name: string; averageStars: number } | null;
};

/** "fredag" → "Fredag". */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase("da") + text.slice(1) : text;
}

/** "18:30" or "18:30–23:30" (en dash). */
export function eventTimeText(event: Pick<CalendarEvent, "startsAt" | "endsAt">): string {
  return formatTimeRange(event.startsAt, event.endsAt);
}

/** "Hos Mads · 18:30" (the calendar list, SPEC §9.3). */
export function eventPlaceAndTime(event: CalendarEvent): string {
  return `${event.place.name} · ${eventTimeText(event)}`;
}

/** "Fredag · 18:30" (the hero card, SPEC §9.1; the big date shows day and month). */
export function eventWeekdayAndTime(event: Pick<CalendarEvent, "startsAt" | "endsAt">): string {
  return `${capitalize(formatWeekday(event.startsAt))} · ${eventTimeText(event)}`;
}

/** "ingen events", "1 event", "3 events". */
export function eventCountLabel(count: number): string {
  if (count <= 0) return "ingen events";
  return count === 1 ? "1 event" : `${count} events`;
}

/**
 * A date key as text, "fredag 23. oktober" (+ the year when it is not the
 * current year). Formatted at noon Copenhagen time, so no clock change can
 * move it to another day.
 */
export function dateKeyLabel(dateKey: DateKey, now: Date): string {
  const noon = zonedDateTimeToUtc(dateKey, "12:00");
  return noon ? formatLongDate(noon, now) : "";
}

/** The mobile month grid's day buttons: "fredag 23. oktober, 1 event". */
export function dayButtonLabel(dateKey: DateKey, count: number, now: Date): string {
  return `${dateKeyLabel(dateKey, now)}, ${eventCountLabel(count)}`;
}
