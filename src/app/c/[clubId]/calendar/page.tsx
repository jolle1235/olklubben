import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { CalendarHistory } from "@/components/features/calendar/calendar-history";
import { CalendarList } from "@/components/features/calendar/calendar-list";
import { CalendarMonth } from "@/components/features/calendar/calendar-month";
import { resolveCalendarParams } from "@/components/features/calendar/calendar-params";
import { CalendarTodayLink } from "@/components/features/calendar/month-nav";
import { CalendarViewToggle } from "@/components/features/calendar/view-toggle";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { newEventHref as newEventPath } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { monthGridRange, monthKeyOf } from "@/server/domain/calendar/month";
import { CALENDAR_HISTORY_LIMIT } from "@/server/domain/events/history";
import {
  countPastEvents,
  listEventsInRange,
  listPastEvents,
  listUpcomingEvents,
} from "@/server/events/queries";

export const metadata: Metadata = { title: "Kalender" };

/**
 * Kalender (SPEC §9.3, D-107): the club's complete overview, as a list
 * (upcoming events by month, then "Tidligere ølsmagninger" #tidligere: the
 * newest 12, or all with ?past=all) or a month grid (every month, past ones
 * too).
 *
 * The state is in the URL (?view=list|month, ?month=YYYY-MM, ?day=…,
 * ?past=all), parsed with safe fallbacks, so a refresh or a shared link shows
 * the same thing.
 * Without ?view the default depends on the screen: list on mobile, month on
 * desktop. Both are rendered and a CSS breakpoint shows one (display: none
 * also hides the other from screen readers). That needs no JavaScript, never
 * flashes the wrong view, and does not guess from the user agent; the cost is
 * two small queries.
 */
export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/calendar">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);
  // One "now" per request: queries, "today" and past/upcoming styling agree.
  const now = new Date();
  const { view, month, past } = resolveCalendarParams(await searchParams, now);

  const showList = view !== "month";
  const showMonth = view !== "list";
  const grid = monthGridRange(month);
  const [upcoming, gridEvents, pastEvents, pastCount] = await Promise.all([
    showList ? listUpcomingEvents(club.id, now) : [],
    showMonth ? listEventsInRange(club.id, grid.start, grid.end) : [],
    showList
      ? listPastEvents(club.id, now, {
          limit: past === "all" ? undefined : CALENDAR_HISTORY_LIMIT,
        })
      : [],
    showList && past !== "all" ? countPastEvents(club.id, now) : 0,
  ]);

  const newEventHref = newEventPath(club.id);
  // The toggle keeps a browsed month, but not the current one (bookmarks stay "now").
  const keptMonth = month === monthKeyOf(now) ? null : month;

  const listView = (
    <>
      <CalendarViewToggle clubId={club.id} active="list" month={keptMonth} />
      <div className="flex flex-col gap-10 md:gap-12">
        <CalendarList clubId={club.id} events={upcoming} now={now} newEventHref={newEventHref} />
        <CalendarHistory
          clubId={club.id}
          events={pastEvents}
          total={past === "all" ? pastEvents.length : pastCount}
          now={now}
        />
      </div>
    </>
  );
  const monthView = (
    <>
      <CalendarViewToggle
        clubId={club.id}
        active="month"
        month={keptMonth}
        aside={<CalendarTodayLink clubId={club.id} view={view} className="md:hidden" />}
      />
      <CalendarMonth clubId={club.id} monthKey={month} view={view} events={gridEvents} now={now} />
    </>
  );

  return (
    <>
      <TopBarAction>
        <Button asChild size="icon" variant="brass">
          <Link href={newEventHref} aria-label="Opret event">
            <PlusIcon aria-hidden />
          </Link>
        </Button>
      </TopBarAction>

      <PageHeader
        title="Kalender"
        action={
          <Button asChild className="hidden md:inline-flex">
            <Link href={newEventHref}>
              <PlusIcon aria-hidden />
              Opret event
            </Link>
          </Button>
        }
      />

      {view === "list" ? listView : null}
      {view === "month" ? monthView : null}
      {view === null ? (
        <>
          <div className="md:hidden">{listView}</div>
          <div className="hidden md:block">{monthView}</div>
        </>
      ) : null}
    </>
  );
}
