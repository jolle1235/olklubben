import { CalendarDaysIcon, ListIcon, type LucideIcon } from "lucide-react";

import { LinkPending } from "@/components/ui/link-pending";
import type { MonthKey } from "@/server/domain/calendar/month";

import { calendarHref, type CalendarView } from "./calendar-params";
import { ViewToggleLink } from "./view-toggle-link";

export type CalendarViewToggleProps = {
  clubId: string;
  /** The view on screen (marked aria-current). */
  active: CalendarView;
  /** The month to keep when switching to the month view; null = the current month. */
  month: MonthKey | null;
  /** Shown at the right end of the row, e.g. the month view's [I dag]. */
  aside?: React.ReactNode;
};

const VIEWS: { view: CalendarView; label: string; icon: LucideIcon }[] = [
  { view: "list", label: "Liste", icon: ListIcon },
  { view: "month", label: "Måned", icon: CalendarDaysIcon },
];

/**
 * "Liste | Måned" (SPEC §9.3). Plain links that put the choice in the URL
 * (?view=), so a refresh or a shared link keeps it, and it works without
 * JavaScript. The active view is olive (aria-current="page"). With JavaScript,
 * keyboard focus follows a switch to the new view's link (<ViewToggleLink />).
 */
export function CalendarViewToggle({ clubId, active, month, aside }: CalendarViewToggleProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 md:mb-6">
      <nav aria-label="Visning">
        <ul className="inline-flex gap-1 rounded-xl border border-border bg-paper p-1">
          {VIEWS.map(({ view, label, icon: Icon }) => (
            <li key={view}>
              <ViewToggleLink
                view={view}
                active={view === active}
                href={calendarHref(clubId, view === "month" ? { view, month } : { view })}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-ink transition-colors hover:bg-cream-deep aria-[current=page]:bg-olive aria-[current=page]:text-cream aria-[current=page]:hover:bg-olive [&_svg]:size-[1.1em]"
              >
                <LinkPending>
                  <Icon aria-hidden strokeWidth={2.25} />
                  {label}
                </LinkPending>
              </ViewToggleLink>
            </li>
          ))}
        </ul>
      </nav>
      {aside}
    </div>
  );
}
