import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { formatLongDate, formatShortDate, toDateKey } from "@/lib/format/date";
import { eventHref } from "@/lib/routes";

import { eventPlaceAndTime, type CalendarEvent } from "./event-format";

export type EventListItemProps = {
  clubId: string;
  event: CalendarEvent;
  /** The request's time (the spoken date leaves out the current year). */
  now: Date;
};

/**
 * A compact event row: "14/11  Juleøl warmup / Hos Jesper · 19:00" (SPEC §9.1
 * "Kommende arrangementer"). Render it inside a <li> of a bordered list with
 * divide-y; the row draws its focus ring inside itself, because such lists
 * clip their children (overflow-hidden, F-029). Screen readers hear the full
 * date instead of "14/11".
 */
export function EventListItem({ clubId, event, now }: EventListItemProps) {
  return (
    <Link
      href={eventHref(clubId, event.id)}
      className="group/row flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-cream-deep/70 focus-visible:-outline-offset-3 md:px-5"
    >
      <time
        aria-hidden
        dateTime={toDateKey(event.startsAt)}
        className="w-14 shrink-0 font-display text-xl font-bold text-olive"
      >
        {formatShortDate(event.startsAt)}
      </time>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg leading-snug font-semibold break-words hyphens-auto text-olive">
          {event.title}
        </span>
        <span className="sr-only">, {formatLongDate(event.startsAt, now)}, </span>
        <span className="block text-[0.95rem] break-words text-slate">
          {eventPlaceAndTime(event)}
        </span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-slate transition-transform group-hover/row:translate-x-0.5"
      />
    </Link>
  );
}
