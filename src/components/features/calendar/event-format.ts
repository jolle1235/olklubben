import {
  formatLongDate,
  formatShortDate,
  formatTimeRange,
  formatWeekday,
  formatWeekdayDateTime,
} from "@/lib/format/date";
import { zonedDateTimeToUtc, type DateKey } from "@/server/domain/events/time";

/**
 * Texts for events – and the dashed "Mulig dato" of polls (round 4, D-137) –
 * on Overblik and in the calendar (SPEC §9.1, §9.3), built
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

/**
 * A date option of an OPEN or AWAITING_DECISION poll: the calendar's dashed
 * "Mulig dato" (SPEC §9.3; CalendarPollOption from src/server/polls/queries.ts fits).
 */
export type CalendarPollDate = {
  optionId: string;
  pollId: string;
  pollTitle: string;
  startsAt: Date;
  deadline: Date;
  status: "OPEN" | "AWAITING_DECISION";
  /** The viewer ticked this date ("Du kan ✓"). */
  viewerTicked: boolean;
};

/**
 * What a calendar day or month lists: confirmed events and possible poll
 * dates, side by side (the domain/calendar grouping only needs `startsAt`).
 * `key` is unique across both kinds (React keys).
 */
export type CalendarItem<E extends CalendarEvent = CalendarEvent> =
  | { kind: "event"; key: string; startsAt: Date; event: E }
  | { kind: "poll"; key: string; startsAt: Date; option: CalendarPollDate };

/** Events and poll dates as one list, by start (an event first on the same minute). */
export function calendarItems<E extends CalendarEvent>(
  events: readonly E[],
  pollDates: readonly CalendarPollDate[] = [],
): CalendarItem<E>[] {
  const items: CalendarItem<E>[] = [
    ...events.map((event) => ({
      kind: "event" as const,
      key: `event-${event.id}`,
      startsAt: event.startsAt,
      event,
    })),
    ...pollDates.map((option) => ({
      kind: "poll" as const,
      key: `poll-${option.optionId}`,
      startsAt: option.startsAt,
      option,
    })),
  ];
  // Stable: events (listed first) stay before poll dates at the same instant.
  return items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** How many of each kind a day holds (the mobile dots and labels). */
export function countItems(items: readonly CalendarItem[]): { events: number; polls: number } {
  const polls = items.filter((item) => item.kind === "poll").length;
  return { events: items.length - polls, polls };
}

/** "Ølsmagning #15 (afstemning)": a poll date's title in the list (SPEC §9.3). */
export function pollDateTitle(option: Pick<CalendarPollDate, "pollTitle">): string {
  return `${option.pollTitle} (afstemning)`;
}

/** "Mulig dato · stem inden 10/11" · "Mulig dato · venter på afgørelse" (AWAITING_DECISION). */
export function pollDateMeta(option: Pick<CalendarPollDate, "status" | "deadline">): string {
  return option.status === "OPEN"
    ? `Mulig dato · stem inden ${formatShortDate(option.deadline)}`
    : "Mulig dato · venter på afgørelse";
}

/**
 * The accessible name of a poll date in the month grid: "Mulig dato:
 * Ølsmagning #15, lørdag 14. november kl. 18:30, afstemning, stem inden
 * tirsdag 10. november".
 */
export function pollDateAccessibleName(option: CalendarPollDate, now: Date): string {
  const state =
    option.status === "OPEN"
      ? `stem inden ${formatLongDate(option.deadline, now)}`
      : "venter på afgørelse";
  return `Mulig dato: ${option.pollTitle}, ${formatWeekdayDateTime(option.startsAt)}, afstemning, ${state}`;
}

/** "1 mulig dato", "2 mulige datoer". */
export function pollDateCountLabel(count: number): string {
  return count === 1 ? "1 mulig dato" : `${count} mulige datoer`;
}

/** "1 event" · "1 event, 2 mulige datoer" · "1 mulig dato" · "ingen events". */
export function itemCountLabel(counts: { events: number; polls: number }): string {
  if (counts.polls === 0) return eventCountLabel(counts.events);
  if (counts.events === 0) return pollDateCountLabel(counts.polls);
  return `${eventCountLabel(counts.events)}, ${pollDateCountLabel(counts.polls)}`;
}

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

/**
 * The mobile month grid's day buttons: "fredag 23. oktober, 1 event", plus
 * the poll dates when there are any: "fredag 23. oktober, 1 event, 1 mulig dato".
 */
export function dayButtonLabel(dateKey: DateKey, count: number, now: Date, pollCount = 0): string {
  const polls = pollCount > 0 ? `, ${pollDateCountLabel(pollCount)}` : "";
  return `${dateKeyLabel(dateKey, now)}, ${eventCountLabel(count)}${polls}`;
}
