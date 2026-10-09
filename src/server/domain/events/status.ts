import { formatRelativeDays } from "@/lib/format/date";

import { dateKeyToDayNumber, utcToZonedParts } from "./time";

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

/** The part of an event the time rules need. */
export type EventTiming = { startsAt: Date; endsAt: Date | null };

/** endsAt, or startsAt + 6 hours when the event has no end time. */
export function effectiveEnd(event: EventTiming): Date {
  return event.endsAt ?? new Date(event.startsAt.getTime() + EVENT_FALLBACK_DURATION_MS);
}

/** Upcoming or ongoing: the (effective) end has not passed yet (§9.1). */
export function isUpcomingOrOngoing(event: EventTiming, now: Date): boolean {
  return now.getTime() < effectiveEnd(event).getTime();
}

/** Ongoing: started, and the (effective) end has not passed (start ≤ now < end). */
export function isOngoing(event: EventTiming, now: Date): boolean {
  return event.startsAt.getTime() <= now.getTime() && isUpcomingOrOngoing(event, now);
}

/** Over: the (effective) end has passed. */
export function hasEnded(event: EventTiming, now: Date): boolean {
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
  | { kind: "tomorrow" }
  /** Two or more calendar days ahead. */
  | { kind: "inDays"; days: number }
  /** Over. Overblik never shows it, but the type is total. */
  | { kind: "ended" };

export function heroState(event: EventTiming, now: Date): HeroState {
  if (hasEnded(event, now)) return { kind: "ended" };
  if (isOngoing(event, now)) return { kind: "ongoing" };
  const days = calendarDaysBetween(now, event.startsAt);
  if (days <= 0) return { kind: "tonight" };
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
    case "tomorrow":
      return "I morgen!";
    case "inDays":
      return formatRelativeDays(state.days);
    case "ended":
      return "Afsluttet";
  }
}

/** Highlighted states (amber on the hero card): today and ongoing. */
export function isHeroHighlighted(state: HeroState): boolean {
  return state.kind === "tonight" || state.kind === "ongoing";
}
