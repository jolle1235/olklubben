import { groupEventsByDayKey } from "@/server/domain/calendar/group";
import {
  monthGrid,
  monthKeyLabel,
  WEEKDAYS,
  type CalendarDay,
  type MonthKey,
} from "@/server/domain/calendar/month";
import { hasEnded } from "@/server/domain/events/status";
import { cn } from "@/lib/utils";

import { calendarHref, type CalendarView } from "./calendar-params";
import { CalendarDayPanel } from "./day-panel";
import { DayLink, type DayDot } from "./day-link";
import { EventChip } from "./event-chip";
import { dayButtonLabel, type CalendarEvent } from "./event-format";
import { CalendarMonthNav } from "./month-nav";

export type CalendarMonthProps = {
  clubId: string;
  monthKey: MonthKey;
  /** The URL's view (null = responsive default); kept in the month links. */
  view: CalendarView | null;
  /** Every event that starts inside the grid (monthGridRange), any order. */
  events: CalendarEvent[];
  now: Date;
};

const MAX_DOTS = 3;
const HEADING_ID = "calendar-month-heading";

/**
 * The month view (SPEC §9.3, D-062): a Monday-first grid with Danish weekday
 * headers. From md, events are chips with title and time; below md, a date
 * shows dots and is a link that selects the day, and the day panel under the
 * grid lists its events. Today is marked (aria-current="date"), days of the
 * neighbouring months are muted, past events are muted too.
 *
 * Semantics: a native <table> (caption, column headers with the full weekday
 * names), not role="grid": a grid promises arrow-key navigation, which needs
 * JavaScript, and the calendar must work without it. Screen readers announce
 * the weekday column of each cell, and every link has a full label
 * ("fredag 23. oktober, 1 event"; chips: title, date and time).
 */
export function CalendarMonth({ clubId, monthKey, view, events, now }: CalendarMonthProps) {
  const weeks = monthGrid(monthKey, now);
  const byDay = groupEventsByDayKey(events);

  return (
    <section aria-labelledby={HEADING_ID}>
      <CalendarMonthNav clubId={clubId} monthKey={monthKey} view={view} headingId={HEADING_ID} />

      <div className="md:overflow-hidden md:rounded-xl md:border md:border-border md:bg-paper">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Kalender for {monthKeyLabel(monthKey)}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((weekday) => (
                <th
                  key={weekday.short}
                  scope="col"
                  className="pb-1.5 text-center text-xs font-bold tracking-[0.12em] text-slate uppercase md:bg-cream-deep/50 md:px-2.5 md:py-2 md:text-left"
                >
                  <span aria-hidden>{weekday.short}</span>
                  <span className="sr-only">{weekday.long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.days[0]?.dateKey}>
                {week.days.map((day) => (
                  <DayCell
                    key={day.dateKey}
                    clubId={clubId}
                    day={day}
                    monthKey={monthKey}
                    events={byDay[day.dateKey] ?? []}
                    now={now}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CalendarDayPanel
        clubId={clubId}
        monthKey={monthKey}
        view={view}
        eventsByDay={byDay}
        now={now}
        className="md:hidden"
      />
    </section>
  );
}

function DayCell({
  clubId,
  day,
  monthKey,
  events,
  now,
}: {
  clubId: string;
  day: CalendarDay;
  monthKey: MonthKey;
  events: CalendarEvent[];
  now: Date;
}) {
  const dots: DayDot[] = events
    .slice(0, MAX_DOTS)
    .map((event) => (hasEnded(event, now) ? "past" : "upcoming"));

  return (
    <td
      data-date={day.dateKey}
      className={cn(
        "p-0.5 align-top md:border-t md:border-l md:border-border md:p-0 md:first:border-l-0",
        !day.inMonth && "md:bg-cream-deep/60",
      )}
    >
      {/* Mobile: the date is a link that selects the day (dots, no text). */}
      <div className="md:hidden">
        <DayLink
          href={calendarHref(clubId, {
            view: "month",
            month: day.dateKey.slice(0, 7),
            day: day.dateKey,
          })}
          dateKey={day.dateKey}
          monthKey={monthKey}
          inMonth={day.inMonth}
          isToday={day.isToday}
          day={day.day}
          label={dayButtonLabel(day.dateKey, events.length, now)}
          dots={dots}
        />
      </div>

      {/* Desktop: the day number and readable chips. */}
      <div className="hidden min-h-24 flex-col gap-1 p-1.5 md:flex">
        <span
          aria-current={day.isToday ? "date" : undefined}
          className={cn(
            "grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
            day.isToday ? "bg-harbor text-paper" : day.inMonth ? "text-olive" : "text-slate",
          )}
        >
          {day.day}
        </span>
        {events.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {events.map((event) => (
              <li key={event.id}>
                <EventChip clubId={clubId} event={event} now={now} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </td>
  );
}
