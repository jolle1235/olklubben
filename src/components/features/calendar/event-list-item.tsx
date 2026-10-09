import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { formatLongDate, formatShortDate, toDateKey } from "@/lib/format/date";
import { eventHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { eventPlaceAndTime, eventWeekdayAndTime, type CalendarEvent } from "./event-format";

export type EventListItemProps = {
  clubId: string;
  event: CalendarEvent;
  /** The request's time (the spoken date leaves out the current year). */
  now: Date;
  /** An extra line under place and time, e.g. "4 øl · Bedst: Westmalle Tripel ★ 4,7" (history). */
  meta?: string | null;
  /** A past tasting: quieter colours, like the calendar's past events (D-078). */
  muted?: boolean;
  /**
   * false on a place's own page ("Ølsmagninger her"): the second line is
   * "Fredag · 18:30" instead of repeating the place's name.
   */
  showPlace?: boolean;
};

/**
 * A compact event row: "14/11  Juleøl warmup / Hos Jesper · 19:00" (SPEC §9.1
 * "Kommende arrangementer"). Render it inside a <li> of a bordered list with
 * divide-y; the row draws its focus ring inside itself, because such lists
 * clip their children (overflow-hidden, F-029). Screen readers hear the full
 * date instead of "14/11". History rows (Overblik's "Tidligere ølsmagninger",
 * a place's "Ølsmagninger her") pass `muted` and a `meta` line.
 */
export function EventListItem({
  clubId,
  event,
  now,
  meta,
  muted = false,
  showPlace = true,
}: EventListItemProps) {
  return (
    <Link
      href={eventHref(clubId, event.id)}
      className="group/row flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-cream-deep/70 focus-visible:-outline-offset-3 md:px-5"
    >
      <time
        aria-hidden
        dateTime={toDateKey(event.startsAt)}
        className={cn(
          "w-14 shrink-0 font-display text-xl font-bold",
          muted ? "text-slate" : "text-olive",
        )}
      >
        {formatShortDate(event.startsAt)}
      </time>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-heading text-lg leading-snug font-semibold break-words hyphens-auto",
            muted ? "text-ink" : "text-olive",
          )}
        >
          {event.title}
        </span>
        <span className="sr-only">, {formatLongDate(event.startsAt, now)}, </span>
        <span className="block text-[0.95rem] break-words text-slate">
          {showPlace ? eventPlaceAndTime(event) : eventWeekdayAndTime(event)}
        </span>
        {meta ? (
          <span className="mt-0.5 block text-[0.95rem] break-words hyphens-auto text-ink">
            {meta}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-slate transition-transform group-hover/row:translate-x-0.5"
      />
    </Link>
  );
}
