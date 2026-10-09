import { tz } from "@date-fns/tz";
import { getISOWeek } from "date-fns";

import { formatMonthLabel } from "@/lib/format/date";
import {
  formatDateKey,
  MAX_EVENT_YEAR,
  pad2,
  parseDateKey,
  utcToZonedParts,
  zonedDateTimeToUtc,
  type DateKey,
} from "@/server/domain/events/time";

/**
 * Months for the calendar (SPEC §9.3): "YYYY-MM" keys from the URL
 * (?month=2026-10), previous/next month and a Monday-first month grid in
 * Europe/Copenhagen.
 *
 * The grid is calendar arithmetic on date keys (no time zone involved); only
 * "today" and the UTC ranges for database queries depend on the zone, and
 * they go through src/server/domain/events/time.ts.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** "YYYY-MM", a month in Europe/Copenhagen. */
export type MonthKey = string;

export const MIN_MONTH_YEAR = 1900;
export const MAX_MONTH_YEAR = 2999;

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

type MonthParts = { year: number; month: number };

const DAY_MS = 86_400_000;

/**
 * No event starts after MAX_EVENT_YEAR, so any range end past it can use this
 * bound. Range ends in year MAX_EVENT_YEAR + 1 (the day after 2999-12's grid
 * or month) are not valid date keys, so zonedDateTimeToUtc cannot give them.
 */
const AFTER_LAST_EVENT = new Date(Date.UTC(MAX_EVENT_YEAR + 1, 0, 1));

function toMonthKey({ year, month }: MonthParts): MonthKey {
  return `${String(year).padStart(4, "0")}-${pad2(month)}`;
}

function parseMonthParts(value: unknown): MonthParts | null {
  if (typeof value !== "string") return null;
  const match = MONTH_KEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const [year, month] = [Number(match[1]), Number(match[2])];
  if (year < MIN_MONTH_YEAR || year > MAX_MONTH_YEAR || month < 1 || month > 12) return null;
  return { year, month };
}

/** A valid "YYYY-MM" (1900-01 … 2999-12), trimmed, or null. */
export function parseMonthKey(value: unknown): MonthKey | null {
  const parts = parseMonthParts(value);
  return parts ? toMonthKey(parts) : null;
}

/** The Copenhagen month of an instant: 2026-10-31T23:30Z → "2026-11". */
export function monthKeyOf(instant: Date): MonthKey {
  return utcToZonedParts(instant).date.slice(0, 7);
}

/** `months` months later (or earlier). An invalid key is treated as 1970-01. */
export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  const parts = parseMonthParts(key) ?? { year: 1970, month: 1 };
  const index = parts.year * 12 + (parts.month - 1) + Math.trunc(months);
  return toMonthKey({ year: Math.floor(index / 12), month: (index % 12) + 1 });
}

export function prevMonthKey(key: MonthKey): MonthKey {
  return addMonthsToKey(key, -1);
}

export function nextMonthKey(key: MonthKey): MonthKey {
  return addMonthsToKey(key, 1);
}

/** The first day of the month as a date key: "2026-10" → "2026-10-01". */
export function monthFirstDateKey(key: MonthKey): DateKey {
  const parts = parseMonthParts(key) ?? { year: 1970, month: 1 };
  return formatDateKey({ ...parts, day: 1 });
}

/** The UTC instant the month starts in Copenhagen (the 1st at 00:00). */
export function monthStart(key: MonthKey): Date {
  const start = zonedDateTimeToUtc(monthFirstDateKey(key), "00:00");
  // Cannot happen: the first of any valid month (or of the 1970-01 fallback) is a valid date key.
  if (!start) throw new Error(`monthStart: ugyldig måned ${key}`);
  return start;
}

/**
 * The month as a half-open UTC range [start, end) for queries such as
 * listEventsInRange(clubId, start, end). The range of the last month
 * (2999-12) ends after every possible event.
 */
export function monthRange(key: MonthKey): { start: Date; end: Date } {
  const next = parseMonthKey(nextMonthKey(key));
  return { start: monthStart(key), end: next ? monthStart(next) : AFTER_LAST_EVENT };
}

/** "oktober 2026" */
export function monthKeyLabel(key: MonthKey): string {
  return formatMonthLabel(monthStart(key));
}

/** Monday-first weekday labels (Danish), for the grid header. */
export const WEEKDAYS: readonly { short: string; long: string }[] = [
  { short: "man", long: "mandag" },
  { short: "tir", long: "tirsdag" },
  { short: "ons", long: "onsdag" },
  { short: "tor", long: "torsdag" },
  { short: "fre", long: "fredag" },
  { short: "lør", long: "lørdag" },
  { short: "søn", long: "søndag" },
];

export type CalendarDay = {
  /** "YYYY-MM-DD" */
  dateKey: DateKey;
  /** Day of the month, 1–31. */
  day: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  /** False for the leading/trailing days of the neighbouring months. */
  inMonth: boolean;
  /** The day of `now` in Copenhagen (false when no `now` is given). */
  isToday: boolean;
};

export type CalendarWeek = {
  /** ISO 8601 week number (Danish week numbers), 1–53. */
  weekNumber: number;
  days: CalendarDay[];
};

function dayNumberToParts(dayNumber: number): { year: number; month: number; day: number } {
  const date = new Date(dayNumber * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** 0 = Monday … 6 = Sunday. 1970-01-01 (day 0) was a Thursday. */
function weekdayOfDayNumber(dayNumber: number): number {
  return (((dayNumber + 3) % 7) + 7) % 7;
}

/** The ISO week number of a date key (Danish "uge 44"), or NaN for an invalid key. */
export function isoWeekOfDateKey(dateKey: DateKey): number {
  const parts = parseDateKey(dateKey);
  if (!parts) return Number.NaN;
  const noonUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return getISOWeek(noonUtc, { in: tz("UTC") });
}

/** Days since 1970-01-01. Date.UTC rolls month 13 over to January of the next year. */
function dayNumberOf(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function gridDayNumbers(key: MonthKey): { first: number; last: number } {
  // Straight from the month's parts: re-parsing the next month's key would
  // fail for 2999-12 (3000-01 is out of range) and fall back to 1970.
  const { year, month } = parseMonthParts(key) ?? { year: 1970, month: 1 };
  const firstOfMonth = dayNumberOf(year, month, 1);
  const lastOfMonth = dayNumberOf(year, month + 1, 1) - 1;
  const first = firstOfMonth - weekdayOfDayNumber(firstOfMonth);
  const last = lastOfMonth + (6 - weekdayOfDayNumber(lastOfMonth));
  return { first, last };
}

/**
 * The month as whole weeks, Monday first (4–6 weeks). Days of the
 * neighbouring months fill the first and last week (inMonth = false). With
 * `now`, today's cell has isToday = true.
 */
export function monthGrid(key: MonthKey, now?: Date): CalendarWeek[] {
  const month = monthFirstDateKey(key).slice(0, 7);
  const todayKey = now ? utcToZonedParts(now).date : null;
  const { first, last } = gridDayNumbers(key);

  const weeks: CalendarWeek[] = [];
  for (let weekStart = first; weekStart <= last; weekStart += 7) {
    const days: CalendarDay[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const parts = dayNumberToParts(weekStart + offset);
      const dateKey = formatDateKey(parts);
      days.push({
        dateKey,
        day: parts.day,
        weekday: offset,
        inMonth: dateKey.startsWith(month),
        isToday: dateKey === todayKey,
      });
    }
    weeks.push({ weekNumber: isoWeekOfDateKey(days[0]?.dateKey ?? ""), days });
  }
  return weeks;
}

/**
 * The whole grid (including the neighbouring months' days) as a half-open
 * UTC range, for fetching the events the grid shows. The grid of 2999-12
 * runs into year 3000, so its range ends after every possible event.
 */
export function monthGridRange(key: MonthKey): { start: Date; end: Date } {
  const { first, last } = gridDayNumbers(key);
  const firstKey = formatDateKey(dayNumberToParts(first));
  const afterLastKey = formatDateKey(dayNumberToParts(last + 1));
  const start = zonedDateTimeToUtc(firstKey, "00:00");
  // Cannot happen: the first grid day of any valid month is on or after
  // 1900-01-01 (a Monday), a valid date key.
  if (!start) throw new Error(`monthGridRange: ugyldig måned ${key}`);
  return { start, end: zonedDateTimeToUtc(afterLastKey, "00:00") ?? AFTER_LAST_EVENT };
}
