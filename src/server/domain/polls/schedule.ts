import {
  addDaysToDateKey,
  dateKeyToDayNumber,
  parseTimeOfDay,
  utcToZonedParts,
  zonedDateTimeToUtc,
  type DateKey,
  type TimeOfDay,
} from "@/server/domain/events/time";

import { DEFAULT_POLL_DEADLINE_TIME } from "./options";

/**
 * Poll times (SPEC §9.7.1, §9.7.2, D-134, D-135, E24).
 *
 *   * Every date option starts at one shared Copenhagen wall-clock time
 *     (default 18:30). Wall clock ↔ UTC goes through
 *     src/server/domain/events/time.ts only (D-039, D-069): never hand-written.
 *   * Dates and the deadline lie in the future, and the deadline lies before
 *     the first date. On edit the deadline can only move later.
 *   * The form suggests three dates on the club's usual weekday and a deadline
 *     two days before the first date at 20:00 (clamped).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export type PollTimingError =
  "DATE_PAST" | "DEADLINE_PAST" | "DEADLINE_NOT_BEFORE_FIRST_DATE" | "DEADLINE_SHORTENED";

/**
 * Order: DATE_PAST (a date ≤ now) → DEADLINE_PAST (deadline ≤ now) →
 * DEADLINE_NOT_BEFORE_FIRST_DATE (deadline ≥ the earliest date) →
 * DEADLINE_SHORTENED (deadline < previousDeadline; equal is fine).
 */
export function checkPollTiming(input: {
  now: Date;
  deadline: Date;
  dateStartsAt: readonly Date[];
  previousDeadline?: Date;
}): PollTimingError | null {
  const now = input.now.getTime();
  const deadline = input.deadline.getTime();
  const starts = input.dateStartsAt.map((date) => date.getTime());
  if (starts.some((start) => start <= now)) return "DATE_PAST";
  if (deadline <= now) return "DEADLINE_PAST";
  if (starts.length > 0 && deadline >= Math.min(...starts)) return "DEADLINE_NOT_BEFORE_FIRST_DATE";
  if (input.previousDeadline && deadline < input.previousDeadline.getTime()) {
    return "DEADLINE_SHORTENED";
  }
  return null;
}

/**
 * The UTC instants of the date options: each date at the shared start time,
 * sorted ascending and deduplicated. Invalid keys or an invalid time are
 * skipped (the schema has refused them already).
 */
export function dateOptionInstants(dateKeys: readonly DateKey[], startTime: TimeOfDay): Date[] {
  const times = new Set<number>();
  for (const key of dateKeys) {
    const instant = zonedDateTimeToUtc(key, startTime);
    if (instant) times.add(instant.getTime());
  }
  return [...times].sort((a, b) => a - b).map((time) => new Date(time));
}

/** 0 = Sunday … 6 = Saturday, of a date key (calendar arithmetic only). */
function weekdayOf(dateKey: DateKey): number | null {
  const day = dateKeyToDayNumber(dateKey);
  // 1970-01-01 was a Thursday (4).
  return day === null ? null : (((day + 4) % 7) + 7) % 7;
}

const SATURDAY = 6;
const SUGGESTED_DATE_COUNT = 3;
/** The first suggestion is at least this many days ahead. */
const FIRST_SUGGESTION_DAYS = 7;

/**
 * The club's usual weekday: the most common Copenhagen weekday among the
 * given starts; a tie goes to the weekday of the most recent start among the
 * tied ones. No starts → Saturday.
 */
export function usualWeekday(pastStarts: readonly Date[]): number {
  const counts = new Map<number, { count: number; latest: number }>();
  for (const start of pastStarts) {
    const weekday = weekdayOf(utcToZonedParts(start).date);
    if (weekday === null) continue;
    const entry = counts.get(weekday) ?? { count: 0, latest: -Infinity };
    counts.set(weekday, {
      count: entry.count + 1,
      latest: Math.max(entry.latest, start.getTime()),
    });
  }
  let best: { weekday: number; count: number; latest: number } | null = null;
  for (const [weekday, entry] of counts) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count && entry.latest > best.latest)
    ) {
      best = { weekday, ...entry };
    }
  }
  return best?.weekday ?? SATURDAY;
}

/**
 * Three suggestions on the club's usual weekday (usualWeekday) in
 * consecutive weeks, the first on or after today + 7 days.
 */
export function suggestPollDates(input: {
  today: DateKey;
  pastStarts: readonly Date[];
}): DateKey[] {
  const weekday = usualWeekday(input.pastStarts);
  const earliest = addDaysToDateKey(input.today, FIRST_SUGGESTION_DAYS);
  const earliestWeekday = earliest === null ? null : weekdayOf(earliest);
  if (earliest === null || earliestWeekday === null) return [];
  const first = addDaysToDateKey(earliest, (weekday - earliestWeekday + 7) % 7);
  const dates: DateKey[] = [];
  for (let week = 0; week < SUGGESTED_DATE_COUNT && first; week += 1) {
    const date = addDaysToDateKey(first, week * 7);
    if (date) dates.push(date);
  }
  return dates;
}

/** "+ Tilføj dato": one week after the last date (or today + 7 when there is none). */
export function nextPollDate(lastDate: DateKey | null, today: DateKey): DateKey {
  const from = lastDate ?? today;
  return addDaysToDateKey(from, 7) ?? addDaysToDateKey(today, 7) ?? today;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * The suggested deadline for a first date. Candidates, in order:
 * (first − 2 days, 20:00) → (first − 1 day, 20:00) → (first, start − 3 h).
 * The first candidate strictly inside (now + 1 h, the first start) wins.
 * None (or an invalid date/time) → null.
 */
export function suggestDeadline(input: {
  firstDate: DateKey;
  startTime: TimeOfDay;
  now: Date;
}): { date: DateKey; time: TimeOfDay } | null {
  const firstStart = zonedDateTimeToUtc(input.firstDate, input.startTime);
  if (!firstStart || !parseTimeOfDay(input.startTime)) return null;
  const earliest = input.now.getTime() + HOUR_MS;

  const candidates: { date: DateKey; time: TimeOfDay }[] = [];
  for (const days of [-2, -1]) {
    const date = addDaysToDateKey(input.firstDate, days);
    if (date) candidates.push({ date, time: DEFAULT_POLL_DEADLINE_TIME });
  }
  candidates.push(utcToZonedParts(new Date(firstStart.getTime() - 3 * HOUR_MS)));

  for (const candidate of candidates) {
    const instant = zonedDateTimeToUtc(candidate.date, candidate.time);
    if (instant && instant.getTime() > earliest && instant.getTime() < firstStart.getTime()) {
      return candidate;
    }
  }
  return null;
}

export type TimeLeft =
  | { kind: "days"; days: number; hours: number }
  | { kind: "hours"; hours: number }
  | { kind: "minutes"; minutes: number }
  | { kind: "passed" };

/**
 * Time until the deadline as elapsed duration (floored), not calendar days,
 * so it is right across a DST change. ≥ 24 h → days + hours; ≥ 60 min →
 * hours; > 0 → minutes (0 = "under et minut"); ≤ 0 → passed.
 */
export function timeLeft(deadline: Date, now: Date): TimeLeft {
  const ms = deadline.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return { kind: "passed" };
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return { kind: "days", days: Math.floor(hours / 24), hours: hours % 24 };
  if (hours >= 1) return { kind: "hours", hours };
  return { kind: "minutes", minutes };
}
