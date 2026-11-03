import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { formatDayMonthParts, formatLongDate, formatWeekdayShort } from "@/lib/format/date";
import { eventHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  hasEnded,
  heroState,
  heroStateLabel,
  isHeroHighlighted,
} from "@/server/domain/events/status";

import { eventPlaceAndTime, type CalendarEvent } from "./event-format";

export type EventCardProps = {
  clubId: string;
  event: CalendarEvent;
  /** The request's time: past events are muted, today's get a badge. */
  now: Date;
  /** An extra line, e.g. "4 øl · Bedst: Westmalle Tripel ★ 4,7" (the history section). */
  meta?: string | null;
  className?: string;
};

/**
 * A confirmed event as a big, readable card (SPEC §9.3 list view, §13.4):
 * the day number and short weekday on the left, title, "Hos Mads · 18:30" and
 * the theme on the right. Filled card with a primary accent (§9.3 "Bekræftet
 * event"); a past event is muted, today's and an ongoing one get "I aften! 🍻"
 * / "I gang nu". The whole card links to the event.
 *
 * Server-safe and client-safe (used by the calendar's day panel too).
 */
export function EventCard({ clubId, event, now, meta, className }: EventCardProps) {
  const past = hasEnded(event, now);
  const state = heroState(event, now);
  const badge = !past && isHeroHighlighted(state) ? heroStateLabel(state) : null;

  return (
    <Link
      href={eventHref(clubId, event.id)}
      className={cn(
        "group flex min-h-20 pressable items-center gap-4 rounded-xl border border-l-4 border-border px-4 py-3",
        past
          ? "border-l-border-strong bg-muted/50 hover:bg-muted"
          : "border-l-primary bg-card shadow-raised hover:bg-muted/60",
        className,
      )}
    >
      <span aria-hidden className="flex w-11 shrink-0 flex-col items-center text-center">
        <span
          className={cn(
            "font-display text-headline-md leading-none font-bold",
            past ? "text-muted-foreground" : "text-primary-ink",
          )}
        >
          {formatDayMonthParts(event.startsAt)?.day}
        </span>
        <span className="mt-1.5 text-label-sm font-bold caps text-muted-foreground">
          {formatWeekdayShort(event.startsAt)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="min-w-0 font-heading text-title-sm font-semibold break-words hyphens-auto text-primary-ink">
            {event.title}
          </span>
          {badge ? (
            <span className="rounded-full bg-highlight-subtle px-2.5 py-0.5 text-label-md font-bold whitespace-nowrap text-highlight-ink">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="sr-only">, {formatLongDate(event.startsAt, now)}, </span>
        <span className="block text-body-sm break-words text-muted-foreground">
          {eventPlaceAndTime(event)}
        </span>
        {event.theme ? (
          <span className="mt-0.5 block text-body-sm break-words text-foreground">
            <span className="text-muted-foreground">Tema:</span> {event.theme}
          </span>
        ) : null}
        {meta ? (
          <span className="mt-0.5 block text-body-sm break-words hyphens-auto text-foreground">
            {meta}
          </span>
        ) : null}
      </span>

      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
