import Link from "next/link";
import { ChevronRightIcon, VoteIcon } from "lucide-react";

import { formatDayMonthParts, formatLongDate, formatWeekdayShort } from "@/lib/format/date";
import { pollHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { pollDateMeta, pollDateTitle, type CalendarPollDate } from "./event-format";

export type PollOptionCardProps = {
  clubId: string;
  option: CalendarPollDate;
  now: Date;
  className?: string;
};

/**
 * A possible date of a poll in the calendar list and the day panel (SPEC
 * §9.3 "Afstemning", D-137): the same shape as EventCard, but dashed in
 * info colours on a transparent background, so it never reads as a confirmed
 * event – "Ølsmagning #15 (afstemning)", "🗳 Mulig dato · stem inden 10/11"
 * and "Du kan ✓" when the viewer ticked it. Links to the poll. Disappears
 * once the poll is decided or cancelled (the query only returns OPEN and
 * AWAITING_DECISION polls).
 *
 * Server-safe and client-safe (used by the calendar's day panel too).
 */
export function PollOptionCard({ clubId, option, now, className }: PollOptionCardProps) {
  return (
    <Link
      href={pollHref(clubId, option.pollId)}
      className={cn(
        "group flex min-h-20 pressable items-center gap-4 rounded-xl border-2 border-dashed border-info-border bg-transparent px-4 py-3 hover:bg-info-subtle/50",
        className,
      )}
    >
      <span aria-hidden className="flex w-11 shrink-0 flex-col items-center text-center">
        <span className="font-display text-headline-md leading-none font-bold text-info-ink">
          {formatDayMonthParts(option.startsAt)?.day}
        </span>
        <span className="mt-1.5 text-label-sm font-bold caps text-muted-foreground">
          {formatWeekdayShort(option.startsAt)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="min-w-0 font-heading text-title-sm font-semibold break-words hyphens-auto text-info-ink">
            {pollDateTitle(option)}
          </span>
          {option.viewerTicked ? (
            <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-label-md font-bold whitespace-nowrap text-primary-ink">
              Du kan ✓
            </span>
          ) : null}
        </span>
        <span className="sr-only">, {formatLongDate(option.startsAt, now)}, </span>
        <span className="flex items-start gap-1.5 text-body-sm break-words text-muted-foreground">
          <VoteIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-info-ink" />
          <span className="min-w-0">{pollDateMeta(option)}</span>
        </span>
      </span>

      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
