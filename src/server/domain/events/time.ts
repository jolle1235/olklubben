import { tzOffset } from "@date-fns/tz";

import { APP_TIME_ZONE } from "@/lib/format/date";

/**
 * Event times (SPEC §4.6, §9.2, E20).
 *
 * The form asks for a date and wall-clock times in Europe/Copenhagen; the
 * database stores UTC instants (timestamptz). @date-fns/tz does the time zone
 * maths, so summer/winter time is never computed by hand: 18:30 stays 18:30 on
 * both sides of a clock change.
 *
 *   * Date keys are "YYYY-MM-DD" (what <input type="date"> sends), times are
 *     "HH:mm" (<input type="time">). "HH:mm:ss" and "18.30" are accepted too.
 *   * Overnight rule [BESLUTNING]: an end time earlier than the start time is
 *     on the next day (18:30–01:00 ends at 01:00 the day after). An end time
 *     equal to the start time is invalid.
 *   * DST edge cases follow Temporal's "compatible" rule: a wall-clock time
 *     that does not exist (the spring-forward gap, e.g. 02:30 on 29 March
 *     2026) moves forward by the gap (→ 03:30 summer time); a time that
 *     happens twice (02:30 on 25 October 2026) means the first occurrence, in
 *     summer time. Nobody plans a tasting then; it is only defined so server
 *     and browser always agree.
 *   * Only the zone's UTC offset comes from @date-fns/tz (tzOffset). TZDate's
 *     constructor is not used: it resolves the October overlap differently
 *     depending on the machine's own time zone (F-034).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** "YYYY-MM-DD", a calendar date in Europe/Copenhagen. */
export type DateKey = string;
/** "HH:mm", a 24-hour wall-clock time in Europe/Copenhagen. */
export type TimeOfDay = string;

/** The form's default start time (SPEC §9.2). A UI default, not a rule. */
export const DEFAULT_EVENT_START_TIME: TimeOfDay = "18:30";

/** Years accepted in a date key. Old tastings may be registered (§9.2). */
export const MIN_EVENT_YEAR = 1900;
export const MAX_EVENT_YEAR = 2999;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/;

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hour: number; minute: number };

/** 7 → "07" (months, days, hours, minutes in keys). */
export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The parts of a real calendar date "YYYY-MM-DD" (no 30 February), or null. */
export function parseDateKey(value: unknown): DateParts | null {
  if (typeof value !== "string") return null;
  const match = DATE_KEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_EVENT_YEAR || year > MAX_EVENT_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isDateKey(value: unknown): value is DateKey {
  return parseDateKey(value) !== null;
}

/** "YYYY-MM-DD" from parts (no validation). */
export function formatDateKey({ year, month, day }: DateParts): DateKey {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** The parts of "HH:mm" (also "H:mm", "HH:mm:ss" – seconds ignored – and "18.30"), or null. */
export function parseTimeOfDay(value: unknown): TimeParts | null {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute };
}

/** "HH:mm" for any accepted spelling ("8:05" → "08:05", "18.30" → "18:30"), or null. */
export function normalizeTimeOfDay(value: unknown): TimeOfDay | null {
  const time = parseTimeOfDay(value);
  return time ? `${pad2(time.hour)}:${pad2(time.minute)}` : null;
}

/** Days since 1970-01-01 of a date key (calendar arithmetic only), or null. */
export function dateKeyToDayNumber(dateKey: DateKey): number | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

/** The calendar date `days` days after (or before) a date key. Null for an invalid key. */
export function addDaysToDateKey(dateKey: DateKey, days: number): DateKey | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatDateKey({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/** The zone's offset from UTC in ms at an instant (+2 h in summer, +1 h in winter). */
function offsetMs(instantMs: number): number {
  return tzOffset(APP_TIME_ZONE, new Date(instantMs)) * MINUTE_MS;
}

/**
 * The UTC instant of a Copenhagen date and wall-clock time, e.g.
 * ("2026-10-23", "18:30") → 2026-10-23T16:30:00Z (summer time) and
 * ("2026-10-30", "18:30") → 2026-10-30T17:30:00Z (winter time).
 * Null when the date or time is invalid. See the module note for DST edges.
 */
export function zonedDateTimeToUtc(dateKey: DateKey, time: TimeOfDay): Date | null {
  const date = parseDateKey(dateKey);
  const clock = parseTimeOfDay(time);
  if (!date || !clock) return null;

  // The wall-clock time written as if it were UTC.
  const wall = Date.UTC(date.year, date.month - 1, date.day, clock.hour, clock.minute);
  // A day around the time sees at most one transition: the offsets before and after it.
  const before = wall - offsetMs(wall - DAY_MS);
  const after = wall - offsetMs(wall + DAY_MS);
  const matches = [before, after].filter((instant) => instant + offsetMs(instant) === wall);
  // Normal: one match (or the same twice). Overlap: two, take the earlier.
  // Gap: none, use the offset from before the change, which moves it forward.
  return new Date(matches.length > 0 ? Math.min(...matches) : before);
}

/** The Copenhagen date key and wall-clock time of a UTC instant (for edit forms). */
export function utcToZonedParts(instant: Date): { date: DateKey; time: TimeOfDay } {
  const wall = new Date(instant.getTime() + offsetMs(instant.getTime()));
  return {
    date: formatDateKey({
      year: wall.getUTCFullYear(),
      month: wall.getUTCMonth() + 1,
      day: wall.getUTCDate(),
    }),
    time: `${pad2(wall.getUTCHours())}:${pad2(wall.getUTCMinutes())}`,
  };
}

export type EventTimesInput = {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm", or null/"" when the time is not decided yet (D-175). */
  startTime?: string | null;
  /** "YYYY-MM-DD", or null/"" for no end (D-176). */
  endDate?: string | null;
  /** "HH:mm", or null/"" for no end. Needs a start time and an end date. */
  endTime?: string | null;
};

export type EventTimeField = "date" | "startTime" | "endDate" | "endTime";

export type EventTimesResult =
  | {
      ok: true;
      startsAt: Date;
      endsAt: Date | null;
      /** False: no start time; startsAt is midnight of the date (D-175). */
      hasStartTime: boolean;
    }
  | {
      ok: false;
      field: EventTimeField;
      reason: "invalid" | "missing" | "end-before-start" | "end-without-start";
    };

/**
 * Without a start time (D-175) an event is stored from midnight on its date to
 * the midnight after its last day. midnightAfter encodes the end and lastDayOf
 * decodes it; nothing else should know the rule.
 */
function midnightAfter(dateKey: DateKey): Date | null {
  const next = addDaysToDateKey(dateKey, 1);
  return next ? zonedDateTimeToUtc(next, "00:00") : null;
}

/** The last day of an event without a start time, from its stored endsAt. */
export function lastDayOf(endsAt: Date): DateKey {
  const end = utcToZonedParts(endsAt).date;
  return addDaysToDateKey(end, -1) ?? end;
}

/**
 * startsAt/endsAt (UTC) from the form's dates and times (D-176). The end is
 * always an explicit date and time – an event may last several days, and an
 * end time is never moved to "the next day" behind the member's back.
 *
 *   * With a start time: no end, or both an end date and an end time, after
 *     the start.
 *   * Without a start time (D-175): no end time. The event lasts until the end
 *     of its end date (default: its own date), so it stays upcoming all day.
 *
 * The result always has endsAt > startsAt (the database CHECK), also around a
 * DST change; a time inside the spring gap is refused.
 */
export function resolveEventTimes(input: EventTimesInput): EventTimesResult {
  if (!isDateKey(input.date)) return { ok: false, field: "date", reason: "invalid" };
  const rawStart = input.startTime?.trim() ?? "";
  const rawEndDate = input.endDate?.trim() ?? "";
  const rawEnd = input.endTime?.trim() ?? "";
  if (rawEndDate !== "" && !isDateKey(rawEndDate)) {
    return { ok: false, field: "endDate", reason: "invalid" };
  }
  if (rawEndDate !== "" && rawEndDate < input.date) {
    return { ok: false, field: "endDate", reason: "end-before-start" };
  }

  if (rawStart === "") {
    if (rawEnd !== "") return { ok: false, field: "endTime", reason: "end-without-start" };
    // Midnight exists every day in Copenhagen (the clock changes at 02:00/03:00).
    const startsAt = zonedDateTimeToUtc(input.date, "00:00");
    const endsAt = midnightAfter(rawEndDate || input.date);
    if (!startsAt || !endsAt) return { ok: false, field: "date", reason: "invalid" };
    return { ok: true, startsAt, endsAt, hasStartTime: false };
  }

  const start = normalizeTimeOfDay(rawStart);
  if (!start) return { ok: false, field: "startTime", reason: "invalid" };
  const startsAt = zonedDateTimeToUtc(input.date, start);
  if (!startsAt) return { ok: false, field: "startTime", reason: "invalid" };

  if (rawEndDate === "" && rawEnd === "") {
    return { ok: true, startsAt, endsAt: null, hasStartTime: true };
  }
  if (rawEndDate === "") return { ok: false, field: "endDate", reason: "missing" };
  if (rawEnd === "") return { ok: false, field: "endTime", reason: "missing" };

  const end = normalizeTimeOfDay(rawEnd);
  if (!end) return { ok: false, field: "endTime", reason: "invalid" };
  const endsAt = zonedDateTimeToUtc(rawEndDate, end);
  if (!endsAt) return { ok: false, field: "endTime", reason: "invalid" };
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, field: "endTime", reason: "end-before-start" };
  }
  return { ok: true, startsAt, endsAt, hasStartTime: true };
}

/**
 * The form values of a stored event (edit form): its Copenhagen start date and
 * time and its end date and time ("" without an end). Without a start time the
 * end date is the last day it lasts, "" when that is its own date (D-175, D-176).
 */
export function eventTimesToFormValues(event: {
  startsAt: Date;
  endsAt: Date | null;
  hasStartTime: boolean;
}): {
  date: DateKey;
  startTime: TimeOfDay | "";
  endDate: DateKey | "";
  endTime: TimeOfDay | "";
} {
  const start = utcToZonedParts(event.startsAt);
  if (!event.hasStartTime) {
    const lastDay = event.endsAt ? lastDayOf(event.endsAt) : start.date;
    const endDate = lastDay !== start.date ? lastDay : "";
    return { date: start.date, startTime: "", endDate, endTime: "" };
  }
  if (!event.endsAt) return { date: start.date, startTime: start.time, endDate: "", endTime: "" };
  const end = utcToZonedParts(event.endsAt);
  return { date: start.date, startTime: start.time, endDate: end.date, endTime: end.time };
}
