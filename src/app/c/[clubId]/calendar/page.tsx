import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, VoteIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { CalendarHistory } from "@/components/features/calendar/calendar-history";
import { CalendarList } from "@/components/features/calendar/calendar-list";
import { CalendarMonth } from "@/components/features/calendar/calendar-month";
import { resolveCalendarParams } from "@/components/features/calendar/calendar-params";
import { CalendarTodayLink } from "@/components/features/calendar/month-nav";
import { CalendarViewToggle } from "@/components/features/calendar/view-toggle";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { newEventHref as newEventPath, newPollHref as newPollPath } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { monthGridRange, monthKeyOf } from "@/server/domain/calendar/month";
import { CALENDAR_HISTORY_LIMIT } from "@/server/domain/events/history";
import {
  countPastEvents,
  listEventsInRange,
  listPastEvents,
  listUpcomingEvents,
} from "@/server/events/queries";
import { closeDuePolls } from "@/server/polls/close";
import { listPollDateOptions } from "@/server/polls/queries";

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
 *
 * Polls (round 4, D-137): the possible dates of OPEN and AWAITING_DECISION
 * polls are dashed "Mulig dato" items next to the events (list: from now on;
 * grid: inside the shown weeks). Due polls are closed lazily BEFORE the
 * queries (closeDuePolls, D-131; never throws), so a poll that just ended
 * shows as its event, not as dashed dates.
 */
export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/calendar">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);
  // One "now" per request: queries, "today" and past/upcoming styling agree.
  const now = new Date();
  const { view, month, past } = resolveCalendarParams(await searchParams, now);
  // Lazy close first (D-131): a decided poll must show as its event below.
  await closeDuePolls(club.id, now);

  const showList = view !== "month";
  const showMonth = view !== "list";
  const grid = monthGridRange(month);
  const [upcoming, gridEvents, pastEvents, pastCount, listPollDates, gridPollDates] =
    await Promise.all([
      showList ? listUpcomingEvents(club.id, now) : [],
      showMonth ? listEventsInRange(club.id, grid.start, grid.end) : [],
      showList
        ? listPastEvents(club.id, now, {
            limit: past === "all" ? undefined : CALENDAR_HISTORY_LIMIT,
          })
        : [],
      showList && past !== "all" ? countPastEvents(club.id, now) : 0,
      showList ? listPollDateOptions(club.id, user.id, { from: now }) : [],
      showMonth ? listPollDateOptions(club.id, user.id, { from: grid.start, to: grid.end }) : [],
    ]);

  const newEventHref = newEventPath(club.id);
  const newPollHref = newPollPath(club.id);
  // The toggle keeps a browsed month, but not the current one (bookmarks stay "now").
  const keptMonth = month === monthKeyOf(now) ? null : month;

  const listView = (
    <>
      <CalendarViewToggle clubId={club.id} active="list" month={keptMonth} />
      <div className="flex flex-col gap-10 md:gap-12">
        <CalendarList
          clubId={club.id}
          events={upcoming}
          pollDates={listPollDates}
          now={now}
          newEventHref={newEventHref}
          newPollHref={newPollHref}
        />
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
      <CalendarMonth
        clubId={club.id}
        monthKey={month}
        view={view}
        events={gridEvents}
        pollDates={gridPollDates}
        now={now}
      />
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
          <div className="hidden flex-wrap items-center gap-3 md:flex">
            <Button asChild variant="outline">
              <Link href={newPollHref}>
                <VoteIcon aria-hidden />
                Planlæg ølsmagning
              </Link>
            </Button>
            <Button asChild>
              <Link href={newEventHref}>
                <PlusIcon aria-hidden />
                Opret event
              </Link>
            </Button>
          </div>
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
