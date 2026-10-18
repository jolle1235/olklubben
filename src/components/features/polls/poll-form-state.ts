import { formatWeekdayDate, formatWeekdayDateTime } from "@/lib/format/date";
import {
  isDateKey,
  normalizeTimeOfDay,
  utcToZonedParts,
  zonedDateTimeToUtc,
  type DateKey,
  type TimeOfDay,
} from "@/server/domain/events/time";
import {
  DEFAULT_POLL_DEADLINE_TIME,
  DEFAULT_POLL_START_TIME,
  hasSomethingToVoteOn,
  MAX_POLL_DATE_OPTIONS,
} from "@/server/domain/polls/options";
import { nextPollDate, suggestDeadline } from "@/server/domain/polls/schedule";

/**
 * The "Planlæg ølsmagning" form's rules (SPEC §9.7.1, D-134, D-135) as pure
 * functions: the date rows, which places start ticked, the deadline that
 * follows the first date until it is touched, and the live hints. "Rediger"
 * uses the same rules while nobody has voted (D-153), starting from the
 * poll's own options. The server decides again (pollFormSchema / createPoll,
 * pollEditSchema / updatePoll); this only drives what the form shows and
 * pre-fills.
 *
 * Pure module: client-safe. Nothing here reads the clock – `now` is passed in
 * (an event handler's `new Date()`, never a render's).
 */

// ── Date rows ───────────────────────────────────────────────────────────────

/** One `<input type="date" name="dates">` row. `key` is stable across edits (React key, focus). */
export type DateRow = { key: string; date: string };

/**
 * The rows to start with: the echo of a failed submit (blank rows kept, so
 * the member sees exactly what was sent), else the suggestions, else one row
 * one week from today.
 */
export function initialDateRows(input: {
  echoed?: readonly string[] | null;
  suggested: readonly DateKey[];
  today: DateKey;
}): DateRow[] {
  const source =
    input.echoed && input.echoed.length > 0
      ? input.echoed
      : input.suggested.length > 0
        ? input.suggested
        : [nextPollDate(null, input.today)];
  return source.slice(0, MAX_POLL_DATE_OPTIONS).map((date, index) => ({
    key: `date-initial-${index}`,
    date,
  }));
}

export function canAddDateRow(rows: readonly DateRow[]): boolean {
  return rows.length < MAX_POLL_DATE_OPTIONS;
}

/** The last row can never be removed (there must be a field to type in). */
export function canRemoveDateRow(rows: readonly DateRow[]): boolean {
  return rows.length > 1;
}

/** The valid dates, sorted and deduplicated (what the poll will offer). */
export function validDates(rows: readonly DateRow[]): DateKey[] {
  return [...new Set(rows.map((row) => row.date.trim()).filter((date) => isDateKey(date)))].sort();
}

/**
 * "+ Tilføj dato": one week after the latest valid date (or today + 7 days).
 * Unchanged at the maximum.
 */
export function addDateRow(rows: readonly DateRow[], today: DateKey, key: string): DateRow[] {
  if (!canAddDateRow(rows)) return [...rows];
  const latest = validDates(rows).at(-1) ?? null;
  return [...rows, { key, date: nextPollDate(latest, today) }];
}

export function removeDateRow(rows: readonly DateRow[], key: string): DateRow[] {
  if (!canRemoveDateRow(rows)) return [...rows];
  return rows.filter((row) => row.key !== key);
}

export function changeDateRow(rows: readonly DateRow[], key: string, date: string): DateRow[] {
  return rows.map((row) => (row.key === key ? { ...row, date } : row));
}

/** "lørdag 14. november" beside a row, or "" while the row is not a valid date. */
export function dateRowLabel(date: string): string {
  if (!isDateKey(date)) return "";
  const noon = zonedDateTimeToUtc(date, "12:00");
  return noon ? formatWeekdayDate(noon) : "";
}

/** The ✕ button's accessible name: "Fjern dato 2 (lørdag 21. november)". */
export function removeDateLabel(index: number, date: string): string {
  const label = dateRowLabel(date);
  return label ? `Fjern dato ${index + 1} (${label})` : `Fjern dato ${index + 1}`;
}

/**
 * The hint under the dates. The suggestions are on the club's usual weekday,
 * so the hint names it while the rows are still exactly the suggestions.
 */
export function datesHint(suggested: readonly DateKey[]): string {
  const [first] = suggested;
  const weekday = first ? dateRowLabel(first).split(" ")[0] : "";
  if (suggested.length === 3 && weekday) {
    return `Forslag: de næste tre ${pluralWeekday(weekday)}. Ret dem, som det passer.`;
  }
  return "Tilføj de datoer, klubben kan vælge imellem.";
}

/** "lørdag" → "lørdage", "onsdag" → "onsdage". */
function pluralWeekday(weekday: string): string {
  return `${weekday}e`;
}

// ── Places ──────────────────────────────────────────────────────────────────

/** The places that start ticked, and whether "＋ Nyt sted" does. */
export type PlaceSelection = { placeIds: string[]; newPlace: boolean };

/**
 * Where the place checkboxes start (D-135, D-153):
 *   1. the echo of a failed submit (ids still offered);
 *   2. the edit form: the poll's current places (`current`, still offered);
 *   3. no places at all → "＋ Nyt sted" ticked and open;
 *   4. exactly one place → ticked;
 *   5. more → nothing (the member picks the candidates).
 */
export function initialPlaceSelection(input: {
  placeIds: readonly string[];
  echo?: { placeIds?: readonly string[]; newPlace?: string } | null;
  current?: readonly string[] | null;
}): PlaceSelection {
  const offered = new Set(input.placeIds);
  const echo = input.echo;
  if (echo && (echo.placeIds !== undefined || echo.newPlace !== undefined)) {
    return {
      placeIds: (echo.placeIds ?? []).filter((id) => offered.has(id)),
      newPlace: echo.newPlace === "on",
    };
  }
  if (input.current) {
    return { placeIds: input.current.filter((id) => offered.has(id)), newPlace: false };
  }
  if (input.placeIds.length === 0) return { placeIds: [], newPlace: true };
  if (input.placeIds.length === 1) return { placeIds: [...input.placeIds], newPlace: false };
  return { placeIds: [], newPlace: false };
}

/** Ticks or unticks one place, keeping the order the member ticked them in. */
export function togglePlace(placeIds: readonly string[], id: string, checked: boolean): string[] {
  const rest = placeIds.filter((placeId) => placeId !== id);
  return checked ? [...rest, id] : rest;
}

export function placeCount(selection: PlaceSelection): number {
  return selection.placeIds.length + (selection.newPlace ? 1 : 0);
}

// ── Deadline ────────────────────────────────────────────────────────────────

export type DeadlineValue = { date: string; time: string };

/**
 * Where the deadline starts: the echo, else the suggestion, else empty at
 * 20:00. `pinned` (the edit form's stored deadline, D-153) starts touched, so
 * it never follows the dates.
 */
export function initialDeadline(input: {
  echoed?: { date?: string; time?: string } | null;
  suggested: { date: DateKey; time: TimeOfDay } | null;
  pinned?: boolean;
}): { value: DeadlineValue; touched: boolean } {
  const { echoed, suggested } = input;
  if (echoed && (echoed.date !== undefined || echoed.time !== undefined)) {
    return {
      value: { date: echoed.date ?? "", time: echoed.time ?? DEFAULT_POLL_DEADLINE_TIME },
      // After a failed submit the field holds exactly what was sent: keep it.
      touched: true,
    };
  }
  return {
    value: suggested ?? { date: "", time: DEFAULT_POLL_DEADLINE_TIME },
    touched: input.pinned === true,
  };
}

/**
 * The deadline after the dates or the start time changed: untouched it
 * follows suggestDeadline(first date) – kept when nothing fits (or there is no
 * valid date yet); touched it is the member's own.
 */
export function followDeadline(input: {
  current: DeadlineValue;
  touched: boolean;
  rows: readonly DateRow[];
  startTime: string;
  now: Date;
}): DeadlineValue {
  if (input.touched) return input.current;
  const [firstDate] = validDates(input.rows);
  const startTime = normalizeTimeOfDay(input.startTime);
  if (!firstDate || !startTime) return input.current;
  return suggestDeadline({ firstDate, startTime, now: input.now }) ?? input.current;
}

/** The deadline as an instant, or null while the fields are incomplete. */
export function deadlineInstant(value: DeadlineValue): Date | null {
  const time = normalizeTimeOfDay(value.time);
  if (!isDateKey(value.date) || !time) return null;
  return zonedDateTimeToUtc(value.date, time);
}

// ── Live hints ──────────────────────────────────────────────────────────────

export type ShapeHint =
  /** One date, ≥ 2 places: the date is fixed. */
  | "date-fixed"
  /** One place, ≥ 2 dates: the place is fixed. */
  | "place-fixed"
  /** One date and one place: nothing to vote on – make an event instead. */
  | "nothing-to-vote"
  | null;

/** Which hint the form shows for the current counts (nothing until both have ≥ 1). */
export function shapeHint(dateCount: number, places: number): ShapeHint {
  if (dateCount === 0 || places === 0) return null;
  if (!hasSomethingToVoteOn(dateCount, places)) return "nothing-to-vote";
  if (dateCount === 1) return "date-fixed";
  if (places === 1) return "place-fixed";
  return null;
}

export const SHAPE_HINT_TEXT: Record<Exclude<ShapeHint, null>, string> = {
  "date-fixed": "Kun én dato: den ligger fast, og I stemmer kun om stedet.",
  "place-fixed": "Kun ét sted: det ligger fast, og I stemmer kun om datoen.",
  "nothing-to-vote": "Med én dato og ét sted er der ikke noget at stemme om.",
};

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The line above the button: "Klubben stemmer om 3 datoer og 2 steder · frist
 * torsdag 12. november kl. 20:00." Null while there is nothing to vote on.
 */
export function pollSummary(input: {
  dateCount: number;
  placeCount: number;
  deadline: Date | null;
}): string | null {
  const { dateCount, placeCount: places, deadline } = input;
  if (!hasSomethingToVoteOn(dateCount, places)) return null;
  const parts: string[] = [];
  if (dateCount > 1) parts.push(count(dateCount, "dato", "datoer"));
  if (places > 1) parts.push(count(places, "sted", "steder"));
  const subject = `Klubben stemmer om ${parts.join(" og ")}`;
  return deadline ? `${subject} · frist ${formatWeekdayDateTime(deadline)}.` : `${subject}.`;
}

/**
 * What the form says about the plan right now: the live hint, the summary
 * above the button, and the date and the single place for "opret et event i
 * stedet" (C16).
 */
export function pollPlanStatus(input: {
  rows: readonly DateRow[];
  selection: PlaceSelection;
  deadline: DeadlineValue;
}): {
  hint: ShapeHint;
  summary: string | null;
  firstDate: DateKey | null;
  onlyPlace: string | null;
} {
  const dates = validDates(input.rows);
  const places = placeCount(input.selection);
  const { placeIds, newPlace } = input.selection;
  return {
    hint: shapeHint(dates.length, places),
    summary: pollSummary({
      dateCount: dates.length,
      placeCount: places,
      deadline: deadlineInstant(input.deadline),
    }),
    firstDate: dates[0] ?? null,
    onlyPlace: placeIds.length === 1 && !newPlace ? (placeIds[0] ?? null) : null,
  };
}

// ── Edit (D-153) ────────────────────────────────────────────────────────────

/**
 * Where "Rediger" starts while nobody has voted: the poll's dates as
 * Copenhagen calendar days, their shared start time (from the first option;
 * every option has the same wall-clock time, D-134) and the stored deadline.
 */
export function pollEditDefaults(input: { dates: readonly Date[]; deadline: Date }): {
  dates: DateKey[];
  startTime: TimeOfDay;
  deadline: { date: DateKey; time: TimeOfDay };
} {
  const [first] = input.dates;
  return {
    dates: input.dates.map((date) => utcToZonedParts(date).date),
    startTime: first ? utcToZonedParts(first).time : DEFAULT_POLL_START_TIME,
    deadline: utcToZonedParts(input.deadline),
  };
}
