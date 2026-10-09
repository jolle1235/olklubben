import { toDateKey } from "@/lib/format/date";
import type { DateKey } from "@/server/domain/events/time";

import { monthKeyOf, type MonthKey } from "./month";

/**
 * Grouping events for the calendar (SPEC §9.3) by Copenhagen day (month grid:
 * dots/chips per date) and by month (list view: "OKTOBER 2026"). An event
 * belongs to the day it starts on, also when it ends after midnight.
 *
 * Generic over anything with a `startsAt`, so the callers keep their own
 * event shape. Results are sorted by startsAt (ties: input order).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

type Startable = { startsAt: Date };

function byStart<T extends Startable>(events: readonly T[], order: "asc" | "desc"): T[] {
  const direction = order === "asc" ? 1 : -1;
  // Array.prototype.sort is stable, so ties keep the input order.
  return [...events].sort((a, b) => direction * (a.startsAt.getTime() - b.startsAt.getTime()));
}

/**
 * Events per Copenhagen day: { "2026-10-23": [event, …], … }. A plain object
 * (not a Map), so it can be passed to a Client Component. Days without events
 * have no key.
 */
export function groupEventsByDayKey<T extends Startable>(
  events: readonly T[],
): Record<DateKey, T[]> {
  const groups: Record<DateKey, T[]> = {};
  for (const event of byStart(events, "asc")) {
    (groups[toDateKey(event.startsAt)] ??= []).push(event);
  }
  return groups;
}

export type MonthGroup<T> = { monthKey: MonthKey; events: T[] };

/**
 * Events per Copenhagen month, for the list view. "asc" (default): oldest
 * month and event first (upcoming list); "desc": newest first (history).
 */
export function groupEventsByMonth<T extends Startable>(
  events: readonly T[],
  order: "asc" | "desc" = "asc",
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const event of byStart(events, order)) {
    const monthKey = monthKeyOf(event.startsAt);
    const last = groups.at(-1);
    if (last && last.monthKey === monthKey) last.events.push(event);
    else groups.push({ monthKey, events: [event] });
  }
  return groups;
}
