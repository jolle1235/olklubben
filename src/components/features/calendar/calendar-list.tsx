import Link from "next/link";
import { CalendarDaysIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { groupEventsByMonth } from "@/server/domain/calendar/group";
import { monthKeyLabel } from "@/server/domain/calendar/month";

import { EventCard } from "./event-card";
import type { CalendarEvent } from "./event-format";

export type CalendarListProps = {
  clubId: string;
  /** Upcoming and ongoing events, oldest first. */
  events: CalendarEvent[];
  now: Date;
  newEventHref: string;
};

/**
 * The list view's upcoming part (SPEC §9.3): upcoming and ongoing events
 * grouped by month ("OKTOBER 2026"), each a big card. The past tastings follow
 * in their own section (CalendarHistory, D-107).
 */
export function CalendarList({ clubId, events, now, newEventHref }: CalendarListProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDaysIcon />}
        title="Ingen kommende ølsmagninger endnu 🍺"
        description="Sæt en dato i kalenderen, så I har noget at glæde jer til."
        actions={
          // From md the page header holds the same button (one primary action, §13.4).
          <Button asChild size="lg" className="md:hidden">
            <Link href={newEventHref}>
              <PlusIcon aria-hidden />
              Opret event
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupEventsByMonth(events).map(({ monthKey, events: monthEvents }) => (
        <section key={monthKey} aria-labelledby={`calendar-list-${monthKey}`}>
          <h2
            id={`calendar-list-${monthKey}`}
            className="mb-3 flex items-center gap-3 font-display text-base font-bold tracking-[0.16em] text-olive uppercase after:h-px after:flex-1 after:bg-border"
          >
            {monthKeyLabel(monthKey)}
          </h2>
          <ul className="grid grid-cols-1 gap-3">
            {monthEvents.map((event) => (
              <li key={event.id}>
                <EventCard clubId={clubId} event={event} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
