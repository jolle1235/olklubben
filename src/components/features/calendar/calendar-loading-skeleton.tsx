"use client";

import { useSearchParams } from "next/navigation";

import { parseCalendarView } from "./calendar-params";
import { CalendarSkeleton } from "./calendar-skeleton";

/**
 * Kalender's loading.tsx fallback: the skeleton of the view the URL asks for
 * (?view), so a list does not turn into a month grid while the page loads.
 * The route is dynamic (it needs the session), so useSearchParams() also
 * works in the server render.
 */
export function CalendarLoadingSkeleton() {
  const view = parseCalendarView(useSearchParams().get("view"));
  return <CalendarSkeleton view={view} />;
}
