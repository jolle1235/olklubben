import Link from "next/link";
import { CalendarDaysIcon, PlusIcon, VoteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { groupEventsByMonth } from "@/server/domain/calendar/group";
import { monthKeyLabel } from "@/server/domain/calendar/month";

import { EventCard } from "./event-card";
import { calendarItems, type CalendarEvent, type CalendarPollDate } from "./event-format";
import { PollOptionCard } from "./poll-option-card";

export type CalendarListProps = {
  clubId: string;
  /** Upcoming and ongoing events, oldest first. */
  events: CalendarEvent[];
  /** Possible dates of the club's OPEN/AWAITING polls from now on (round 4, D-137). */
  pollDates?: CalendarPollDate[];
  now: Date;
  newEventHref: string;
  newPollHref: string;
};

/**
 * The list view's upcoming part (SPEC §9.3): upcoming and ongoing events
 * grouped by month ("OKTOBER 2026"), each a big card – with the possible
 * dates of open polls merged in as dashed PollOptionCards ("Mulig dato"),
 * each on its own date. The past tastings follow in their own section
 * (CalendarHistory, D-107).
 */
export function CalendarList({
  clubId,
  events,
  pollDates = [],
  now,
  newEventHref,
  newPollHref,
}: CalendarListProps) {
  if (events.length === 0 && pollDates.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDaysIcon />}
        title="Ingen kommende ølsmagninger endnu 🍺"
        description="Sæt en dato i kalenderen – eller lad klubben stemme om, hvornår og hvor."
        actions={
          // From md the page header holds the same buttons (one primary action, §13.4).
          <>
            <Button asChild size="lg" className="md:hidden">
              <Link href={newEventHref}>
                <PlusIcon aria-hidden />
                Opret event
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="md:hidden">
              <Link href={newPollHref}>
                <VoteIcon aria-hidden />
                Planlæg ølsmagning
              </Link>
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupEventsByMonth(calendarItems(events, pollDates)).map(({ monthKey, events: items }) => (
        <section key={monthKey} aria-labelledby={`calendar-list-${monthKey}`}>
          <h2
            id={`calendar-list-${monthKey}`}
            className="mb-3 flex items-center gap-3 font-display text-base font-bold tracking-[0.16em] text-olive uppercase after:h-px after:flex-1 after:bg-border"
          >
            {monthKeyLabel(monthKey)}
          </h2>
          <ul className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <li key={item.key}>
                {item.kind === "event" ? (
                  <EventCard clubId={clubId} event={item.event} now={now} />
                ) : (
                  <PollOptionCard clubId={clubId} option={item.option} now={now} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
