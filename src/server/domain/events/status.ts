import { formatRelativeDays } from "@/lib/format/date";

import { dateKeyToDayNumber, lastDayOf, utcToZonedParts, zonedDateTimeToUtc } from "./time";

/**
 * Where an event is in time (SPEC §9.1).
 *
 * Definition [BESLUTNING, §9.1]: an event counts as *upcoming or ongoing*
 * until its end has passed. Without an endsAt the end is startsAt + 6 hours.
 *
 * The hero card on Overblik counts Copenhagen calendar days, not 24-hour
 * blocks: an event at 18:30 tomorrow is "I morgen!" at 23:59 today, and a
 * calendar day across a clock change is still one day (E20).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const EVENT_FALLBACK_DURATION_HOURS = 6;
export const EVENT_FALLBACK_DURATION_MS = EVENT_FALLBACK_DURATION_HOURS * 60 * 60 * 1000;

/** What "upcoming or over" needs. */
export type EventSpan = { startsAt: Date; endsAt: Date | null };

/**
 * What "ongoing", the hero state and the end text need. `hasStartTime: false`
 * ("Tid følger", D-175): startsAt/endsAt span whole days, so it is upcoming all
 * day but never "ongoing".
 */
export type EventTiming = EventSpan & { hasStartTime: boolean };

/** endsAt, or startsAt + 6 hours when the event has no end time. */
export function effectiveEnd(event: EventSpan): Date {
  return event.endsAt ?? new Date(event.startsAt.getTime() + EVENT_FALLBACK_DURATION_MS);
}

/** Upcoming or ongoing: the (effective) end has not passed yet (§9.1). */
export function isUpcomingOrOngoing(event: EventSpan, now: Date): boolean {
  return now.getTime() < effectiveEnd(event).getTime();
}

/** Ongoing: started, and the (effective) end has not passed (start ≤ now < end). Never without a start time. */
export function isOngoing(event: EventTiming, now: Date): boolean {
  if (!event.hasStartTime) return false;
  return event.startsAt.getTime() <= now.getTime() && isUpcomingOrOngoing(event, now);
}

/** Over: the (effective) end has passed. */
export function hasEnded(event: EventSpan, now: Date): boolean {
  return !isUpcomingOrOngoing(event, now);
}

/**
 * For database queries: an event WITHOUT endsAt is still upcoming or ongoing
 * when startsAt > this instant (now − 6 hours). An event WITH endsAt is when
 * endsAt > now. See src/server/events/queries.ts.
 */
export function fallbackStartCutoff(now: Date): Date {
  return new Date(now.getTime() - EVENT_FALLBACK_DURATION_MS);
}

/**
 * Whole Copenhagen calendar days from `from` to `to` (0 = same day, 1 = `to`
 * is tomorrow, negative = in the past).
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = dateKeyToDayNumber(utcToZonedParts(from).date);
  const toDay = dateKeyToDayNumber(utcToZonedParts(to).date);
  if (fromDay === null || toDay === null) return Number.NaN;
  return toDay - fromDay;
}

/** The hero card's state (SPEC §9.1 "Hero-kortets tilstande"). */
export type HeroState =
  | { kind: "ongoing" }
  /** Today (Copenhagen), before the start: "I aften! 🍻". */
  | { kind: "tonight" }
  /** Today, without a start time (D-175): "I dag! 🍻". */
  | { kind: "today" }
  | { kind: "tomorrow" }
  /** Two or more calendar days ahead. */
  | { kind: "inDays"; days: number }
  /** Over. Overblik never shows it, but the type is total. */
  | { kind: "ended" };

export function heroState(event: EventTiming, now: Date): HeroState {
  if (hasEnded(event, now)) return { kind: "ended" };
  if (isOngoing(event, now)) return { kind: "ongoing" };
  const days = calendarDaysBetween(now, event.startsAt);
  if (days <= 0) return event.hasStartTime ? { kind: "tonight" } : { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  return { kind: "inDays", days };
}

/** "I gang nu", "I aften! 🍻", "I morgen!", "om 3 dage" or "Afsluttet". */
export function heroStateLabel(state: HeroState): string {
  switch (state.kind) {
    case "ongoing":
      return "I gang nu";
    case "tonight":
      return "I aften! 🍻";
    case "today":
      return "I dag! 🍻";
    case "tomorrow":
      return "I morgen!";
    case "inDays":
      return formatRelativeDays(state.days);
    case "ended":
      return "Afsluttet";
  }
}

/** Highlighted states (the highlight role on the hero card): today and ongoing. */
export function isHeroHighlighted(state: HeroState): boolean {
  return state.kind === "tonight" || state.kind === "today" || state.kind === "ongoing";
}

/** Ends this early the day after, an event is still "the same evening" (18:30–01:00). */
const SAME_EVENING_UNTIL = "06:00";

/**
 * When the event runs past its own evening (D-176), the instant to name as its
 * end: a timed event's endsAt on another day (an overnight end before 06:00
 * does not count), or noon on the last day of an event without a start time
 * that lasts several days. Null when it fits one day or evening.
 */
export function laterEnd(event: EventTiming): Date | null {
  if (!event.endsAt) return null;
  if (!event.hasStartTime) {
    const lastDay = lastDayOf(event.endsAt);
    if (lastDay === utcToZonedParts(event.startsAt).date) return null;
    // Noon, so no clock change moves it to another day when it is formatted.
    return zonedDateTimeToUtc(lastDay, "12:00");
  }
  const days = calendarDaysBetween(event.startsAt, event.endsAt);
  if (days === 0) return null;
  if (days === 1 && utcToZonedParts(event.endsAt).time <= SAME_EVENING_UNTIL) return null;
  return event.endsAt;
}
