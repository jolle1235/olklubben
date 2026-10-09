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
 * the theme on the right. Filled card with an olive accent (§9.3 "Bekræftet
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
        "group flex min-h-20 items-center gap-4 rounded-xl border border-l-4 border-border px-4 py-3 transition-colors",
        past
          ? "border-l-slate/60 bg-cream-deep/50 hover:bg-cream-deep"
          : "border-l-olive bg-paper shadow-[0_8px_24px_-20px_rgb(65_68_55/0.55)] hover:bg-cream-deep/60",
        className,
      )}
    >
      <span aria-hidden className="flex w-11 shrink-0 flex-col items-center text-center">
        <span
          className={cn(
            "font-display text-[2rem] leading-none font-bold",
            past ? "text-slate" : "text-olive",
          )}
        >
          {formatDayMonthParts(event.startsAt)?.day}
        </span>
        <span className="mt-1.5 text-xs font-bold tracking-[0.14em] text-slate uppercase">
          {formatWeekdayShort(event.startsAt)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="min-w-0 font-heading text-xl leading-snug font-semibold break-words hyphens-auto text-olive">
            {event.title}
          </span>
          {badge ? (
            <span className="rounded-full bg-amber-tint px-2.5 py-0.5 text-[0.85rem] font-bold whitespace-nowrap text-amber-ink">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="sr-only">, {formatLongDate(event.startsAt, now)}, </span>
        <span className="block text-[0.95rem] break-words text-slate">
          {eventPlaceAndTime(event)}
        </span>
        {event.theme ? (
          <span className="mt-0.5 block text-[0.95rem] break-words text-ink">
            <span className="text-slate">Tema:</span> {event.theme}
          </span>
        ) : null}
        {meta ? (
          <span className="mt-0.5 block text-[0.95rem] break-words hyphens-auto text-ink">
            {meta}
          </span>
        ) : null}
      </span>

      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-slate transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
