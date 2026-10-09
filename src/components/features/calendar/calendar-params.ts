import { monthKeyOf, parseMonthKey, type MonthKey } from "@/server/domain/calendar/month";
import { isDateKey, type DateKey } from "@/server/domain/events/time";

/**
 * The calendar's URL state (SPEC §9.3, D-062):
 *
 *   /c/[clubId]/calendar?view=list|month&month=YYYY-MM&day=YYYY-MM-DD
 *
 *   * view  – "list" or "month". Missing (or invalid) means "the default for
 *             the screen": list on mobile, month on desktop. The page renders
 *             both and lets a CSS breakpoint choose, so there is no flash and
 *             no guessing from the user agent.
 *   * month – the month the grid shows. Missing or invalid → the month of
 *             ?day, else the current Copenhagen month.
 *   * day   – the selected date in the mobile month grid. Ignored unless it
 *             is a real date inside the shown month.
 *
 * All values are untrusted (string, string[] or undefined from searchParams)
 * and never throw. Pure module: client-safe (the day panel reads ?day in the
 * browser with the same rules).
 */

export const CALENDAR_VIEWS = ["list", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

type SearchParamValue = string | string[] | undefined;

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/** "list" | "month", or null (missing or unknown → the responsive default). */
export function parseCalendarView(value: unknown): CalendarView | null {
  const first = firstValue(value);
  return first === "list" || first === "month" ? first : null;
}

/** A valid "YYYY-MM-DD" inside `monthKey`, else null. */
export function parseSelectedDay(value: unknown, monthKey: MonthKey): DateKey | null {
  const first = firstValue(value);
  if (typeof first !== "string") return null;
  const day = first.trim();
  return isDateKey(day) && day.startsWith(`${monthKey}-`) ? day : null;
}

export type CalendarParams = {
  /** null = no explicit choice: list below md, month from md. */
  view: CalendarView | null;
  month: MonthKey;
  day: DateKey | null;
};

export function resolveCalendarParams(
  searchParams: Record<string, SearchParamValue>,
  now: Date,
): CalendarParams {
  const view = parseCalendarView(searchParams.view);
  const dayValue = firstValue(searchParams.day);
  const dayCandidate =
    typeof dayValue === "string" && isDateKey(dayValue.trim()) ? dayValue.trim() : null;
  const month =
    parseMonthKey(firstValue(searchParams.month)) ??
    (dayCandidate ? dayCandidate.slice(0, 7) : monthKeyOf(now));
  return { view, month, day: parseSelectedDay(dayCandidate, month) };
}

/**
 * The query string for a calendar URL, in a stable order and without empty
 * values: { view: "month", month: "2026-10" } → "?view=month&month=2026-10".
 * Nothing set → "".
 */
export type CalendarLinkParams = {
  view?: CalendarView | null;
  month?: MonthKey | null;
  day?: DateKey | null;
};

export function calendarSearch(params: CalendarLinkParams): string {
  const query = new URLSearchParams();
  if (params.view) query.set("view", params.view);
  if (params.month) query.set("month", params.month);
  if (params.day) query.set("day", params.day);
  const search = query.toString();
  return search ? `?${search}` : "";
}

/** "/c/<clubId>/calendar?…" */
export function calendarHref(clubId: string, params: CalendarLinkParams = {}): string {
  return `/c/${clubId}/calendar${calendarSearch(params)}`;
}
