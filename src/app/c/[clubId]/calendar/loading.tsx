import { CalendarLoadingSkeleton } from "@/components/features/calendar/calendar-loading-skeleton";

/**
 * Loading state for Kalender (SPEC §13.4), shaped like the view the page will
 * show: ?view=list or ?view=month at every width, and without ?view the list
 * (mobile) and the month grid (desktop). The calendar never calls notFound()
 * itself (bad ?view, ?month or ?day values fall back to defaults), so
 * streaming is safe (TG-008).
 */
export default function CalendarLoading() {
  return <CalendarLoadingSkeleton />;
}
