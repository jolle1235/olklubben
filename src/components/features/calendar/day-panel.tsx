"use client";

import { useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { newEventHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { monthKeyLabel, type MonthKey } from "@/server/domain/calendar/month";
import type { DateKey } from "@/server/domain/events/time";

import { calendarHref, parseSelectedDay, type CalendarView } from "./calendar-params";
import { EventCard } from "./event-card";
import { capitalize, dateKeyLabel, eventCountLabel, type CalendarEvent } from "./event-format";

export type CalendarDayPanelProps = {
  clubId: string;
  monthKey: MonthKey;
  view: CalendarView | null;
  /** The grid's events per Copenhagen day (groupEventsByDayKey), oldest first. */
  eventsByDay: Record<DateKey, CalendarEvent[]>;
  now: Date;
  className?: string;
};

/**
 * Under the mobile month grid (SPEC §9.3): the selected day's events
 * (?day=YYYY-MM-DD), or – with no day selected – all of the month's events,
 * so the month is readable at a glance. Reads ?day in the browser, so a tap
 * on a date (DayLink) updates it without a server round trip.
 *
 * Screen readers: a sr-only live region announces a selected day ("Søndag
 * 11. oktober: 1 event"); it stays empty without a selection, so browsing
 * months is announced once (by the month heading). "Vis hele måneden"
 * disappears when used, so it moves focus to this panel's heading.
 *
 * A selected day also offers "Opret event denne dag" (the form opens with the
 * date filled in, ?date=).
 */
export function CalendarDayPanel({
  clubId,
  monthKey,
  view,
  eventsByDay,
  now,
  className,
}: CalendarDayPanelProps) {
  const searchParams = useSearchParams();
  const day = parseSelectedDay(searchParams.get("day"), monthKey);

  const events = day
    ? (eventsByDay[day] ?? [])
    : Object.entries(eventsByDay)
        .filter(([dateKey]) => dateKey.startsWith(`${monthKey}-`))
        .flatMap(([, dayEvents]) => dayEvents);
  const heading = capitalize(day ? dateKeyLabel(day, now) : monthKeyLabel(monthKey));
  const monthHref = calendarHref(clubId, { view, month: monthKey });
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <section aria-labelledby="calendar-day-heading" className={cn("mt-6", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          ref={headingRef}
          id="calendar-day-heading"
          tabIndex={-1}
          className="text-xl leading-tight font-bold text-olive"
        >
          {heading}
        </h3>
        {day ? (
          <Link
            href={monthHref}
            scroll={false}
            prefetch={false}
            onNavigate={(event) => {
              event.preventDefault();
              window.history.replaceState(null, "", monthHref);
              headingRef.current?.focus();
            }}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
          >
            Vis hele måneden
          </Link>
        ) : (
          <span className="text-[0.95rem] text-muted-foreground">
            {capitalize(eventCountLabel(events.length))}
          </span>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {day ? `${heading}: ${eventCountLabel(events.length)}` : ""}
      </p>

      {events.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard clubId={clubId} event={event} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border-2 border-dashed border-border bg-paper/60 px-4 py-4 text-[1.05rem] text-muted-foreground">
          {day ? "Ingen events denne dag." : "Ingen events i denne måned."}
        </p>
      )}

      {day ? (
        <Link
          href={newEventHref(clubId, day)}
          className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
        >
          <PlusIcon aria-hidden className="size-4" />
          Opret event denne dag
        </Link>
      ) : null}
    </section>
  );
}
