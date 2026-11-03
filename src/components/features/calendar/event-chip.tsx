import Link from "next/link";

import { formatLongDate, formatTime } from "@/lib/format/date";
import { eventHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { hasEnded } from "@/server/domain/events/status";

import type { CalendarEvent } from "./event-format";

export type EventChipProps = {
  clubId: string;
  event: CalendarEvent;
  now: Date;
};

/**
 * An event in a desktop month cell (SPEC §9.3): title (up to three lines,
 * the full title on hover) and start time, never a tiny unreadable box
 * (§13.4.1): 14 px title, 13 px time.
 * Confirmed events are filled with a primary accent; past ones are muted. The
 * month table clips its cells (rounded corners), so the focus ring is drawn
 * inside the chip (F-029). Screen readers hear the full date and time.
 */
export function EventChip({ clubId, event, now }: EventChipProps) {
  const past = hasEnded(event, now);

  return (
    <Link
      href={eventHref(clubId, event.id)}
      title={event.title}
      className={cn(
        "group/chip block pressable rounded-md border-l-[3px] px-1.5 py-1 focus-visible:-outline-offset-3",
        past
          ? "border-l-border-strong bg-muted text-muted-foreground hover:bg-muted-hover hover:text-foreground"
          : "border-l-primary bg-primary-subtle text-foreground hover:bg-primary-subtle-hover",
      )}
    >
      <span className="line-clamp-3 text-label-lg-tight font-semibold break-words hyphens-auto">
        {event.title}
      </span>
      <span className="sr-only">, {formatLongDate(event.startsAt, now)} kl. </span>
      <span
        className={cn(
          "mt-0.5 block text-label-md-tight tabular-nums",
          past ? "text-muted-foreground group-hover/chip:text-foreground" : "text-primary-ink",
        )}
      >
        {formatTime(event.startsAt)}
      </span>
    </Link>
  );
}
