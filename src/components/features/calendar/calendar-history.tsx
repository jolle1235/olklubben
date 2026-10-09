import Link from "next/link";
import { ArrowDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { groupEventsByMonth } from "@/server/domain/calendar/group";
import { monthKeyLabel } from "@/server/domain/calendar/month";
import { pastEventMetaDisplay } from "@/server/domain/events/history";

import { CALENDAR_HISTORY_ID, calendarHistoryHref } from "./calendar-params";
import { EventCard } from "./event-card";
import { ScrollToHash } from "./scroll-to-hash";
import type { PastCalendarEvent } from "./event-format";

export type CalendarHistoryProps = {
  clubId: string;
  /** Past tastings, newest first (the newest CALENDAR_HISTORY_LIMIT, or all with ?past=all). */
  events: PastCalendarEvent[];
  /** How many past tastings the club has in all ("Vis alle N tidligere"). */
  total: number;
  now: Date;
};

const HEADING_ID = `${CALENDAR_HISTORY_ID}-heading`;

/**
 * "Tidligere ølsmagninger" under the calendar's list view (SPEC §9.3, D-107):
 * past tastings by month, newest month first, as muted cards with the beers
 * and the evening's best-rated one. After the newest few, "Vis alle N
 * tidligere" (?past=all). The section is the link target #tidligere.
 *
 * Each month is a region named "Tidligere ølsmagninger Oktober 2026", so it
 * never shares its name with the same month among the upcoming events.
 * Nothing when the club has no history.
 */
export function CalendarHistory({ clubId, events, total, now }: CalendarHistoryProps) {
  if (events.length === 0) return null;
  const hidden = total - events.length;

  return (
    <section
      id={CALENDAR_HISTORY_ID}
      aria-labelledby={HEADING_ID}
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <ScrollToHash key={events.length} targetId={CALENDAR_HISTORY_ID} />
      <h2 id={HEADING_ID} className="text-2xl leading-tight font-bold text-olive md:text-[1.75rem]">
        Tidligere ølsmagninger
      </h2>

      {groupEventsByMonth(events, "desc").map(({ monthKey, events: monthEvents }) => {
        const monthId = `${CALENDAR_HISTORY_ID}-${monthKey}`;
        return (
          <section key={monthKey} aria-labelledby={`${HEADING_ID} ${monthId}`}>
            <h3
              id={monthId}
              className="mb-3 flex items-center gap-3 font-display text-base font-bold tracking-[0.16em] text-slate uppercase after:h-px after:flex-1 after:bg-border"
            >
              {monthKeyLabel(monthKey)}
            </h3>
            <ul className="grid grid-cols-1 gap-3">
              {monthEvents.map((event) => (
                <li key={event.id}>
                  <EventCard
                    clubId={clubId}
                    event={event}
                    now={now}
                    meta={pastEventMetaDisplay(event)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {hidden > 0 ? (
        <Button asChild variant="outline" className="self-start">
          <Link href={calendarHistoryHref(clubId, { all: true })}>
            <ArrowDownIcon aria-hidden />
            Vis alle {total} tidligere
          </Link>
        </Button>
      ) : null}
    </section>
  );
}
