/**
 * Danish date and time formatting (SPEC §4.6).
 *
 * Every date is shown in Europe/Copenhagen (MVP: one fixed time zone, not per
 * user), whatever the server's or the browser's own zone is. Intl does the
 * time zone maths, so summer/winter time is never computed by hand (E20).
 *
 * The strings are assembled from Intl's parts instead of using Intl's own
 * pattern, because the pattern differs between ICU versions (e.g. "torsdag den
 * 8. oktober" vs "torsdag 8. oktober", "18.30" vs "18:30"). Server and browser
 * must render exactly the same text, or hydration fails.
 *
 * Invalid dates give an empty string instead of throwing.
 *
 * Client-safe: no server-only imports.
 */

export const APP_TIME_ZONE = "Europe/Copenhagen";
export const APP_LOCALE = "da-DK";

export type DateInput = Date | string | number;

const dateParts = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Short weekday and month ("fre.", "okt.", but "maj"): the trailing dot is stripped.
const shortParts = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeParts = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Only used for its numeric parts (year, month, day), never shown to users.
const numericDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type Parts = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

function toDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsOf(format: Intl.DateTimeFormat, date: Date): Parts {
  const parts: Parts = {};
  for (const part of format.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return parts;
}

/** "8. oktober 2026" */
export function formatDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const { day, month, year } = partsOf(dateParts, date);
  return `${day}. ${month} ${year}`;
}

/** "fredag 23. oktober" (no year: for dates in the near future or past). */
export function formatWeekdayDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const { weekday, day, month } = partsOf(dateParts, date);
  return `${weekday} ${day}. ${month}`;
}

/**
 * Day and month as separate strings, for the big date motif (BigDate, SPEC
 * §13.3): { day: "23", month: "oktober" }. Null for an invalid date.
 */
export function formatDayMonthParts(input: DateInput): { day: string; month: string } | null {
  const date = toDate(input);
  if (!date) return null;
  const { day = "", month = "" } = partsOf(dateParts, date);
  return { day, month };
}

/** "18:30" (24-hour clock). */
export function formatTime(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const { hour, minute } = partsOf(timeParts, date);
  return `${hour}:${minute}`;
}

/** "fredag 23. oktober kl. 18:30" */
export function formatWeekdayDateTime(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return `${formatWeekdayDate(date)} kl. ${formatTime(date)}`;
}

/**
 * The calendar date in Copenhagen as "YYYY-MM-DD", e.g. for <time dateTime>.
 * 2026-10-24T22:30Z is already 25 October in Copenhagen → "2026-10-25".
 */
export function toDateKey(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const parts = partsOf(numericDateParts, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** "05/12" (day/month, zero-padded), as in the Overblik list "14/11 Juleøl warmup" (SPEC §9.1). */
export function formatShortDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const { day, month } = partsOf(numericDateParts, date);
  return `${day}/${month}`;
}

/** "oktober 2026" (month heading in the calendar, SPEC §9.3). */
export function formatMonthLabel(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const { month, year } = partsOf(dateParts, date);
  return `${month} ${year}`;
}

/**
 * "fredag 23. oktober", plus the year when it is not the current year in
 * Copenhagen: "tirsdag 5. januar 2027". `now` defaults to the current time;
 * pass the request's `now` when server and browser must agree (hydration).
 */
export function formatLongDate(input: DateInput, now: DateInput = new Date()): string {
  const date = toDate(input);
  if (!date) return "";
  const { weekday, day, month, year } = partsOf(dateParts, date);
  const current = toDate(now);
  const currentYear = current ? partsOf(dateParts, current).year : year;
  return year === currentYear
    ? `${weekday} ${day}. ${month}`
    : `${weekday} ${day}. ${month} ${year}`;
}

/** "fredag" (the Copenhagen weekday). */
export function formatWeekday(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return partsOf(dateParts, date).weekday ?? "";
}

/**
 * "fre", "tor", "søn": always the first three letters, like the month grid's
 * column headers (Intl's own short form varies: "tors.", "fre."). E.g. under
 * the big day in the calendar list.
 */
export function formatWeekdayShort(input: DateInput): string {
  return formatWeekday(input).slice(0, 3);
}

/** "14. sep 2026" (short month without the dot), e.g. "Smagt til Ølsmagning #12 · 14. sep 2026". */
export function formatCompactDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const { day, month = "", year } = partsOf(shortParts, date);
  return `${day}. ${stripDot(month)} ${year}`;
}

/**
 * "18:30–23:00" (en dash, no spaces), or just "18:30" without an end. An end
 * after midnight reads naturally: "18:30–01:00".
 */
export function formatTimeRange(start: DateInput, end?: DateInput | null): string {
  const from = formatTime(start);
  if (!from) return "";
  const to = end == null ? "" : formatTime(end);
  return to ? `${from}–${to}` : from;
}

/**
 * Whole Copenhagen calendar days as text: 0 → "i dag", 1 → "i morgen",
 * 3 → "om 3 dage", -1 → "i går", -4 → "for 4 dage siden". Count the days with
 * calendar-day maths in Europe/Copenhagen (e.g. calendarDaysBetween in
 * src/server/domain/events/status.ts), never with 24-hour blocks.
 */
export function formatRelativeDays(days: number): string {
  if (!Number.isFinite(days)) return "";
  const n = Math.trunc(days);
  if (n === 0) return "i dag";
  if (n === 1) return "i morgen";
  if (n === -1) return "i går";
  return n > 1 ? `om ${n} dage` : `for ${-n} dage siden`;
}

function stripDot(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}
