import { VoteIcon } from "lucide-react";

import { pollHref } from "@/lib/routes";

import { DateCard } from "./date-card";
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
    <DateCard
      href={pollHref(clubId, option.pollId)}
      variant="poll"
      date={option.startsAt}
      now={now}
      title={pollDateTitle(option)}
      badge={option.viewerTicked ? "Du kan ✓" : null}
      className={className}
    >
      <span className="flex items-start gap-1.5 text-body-sm break-words text-muted-foreground">
        <VoteIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-info-ink" />
        <span className="min-w-0">{pollDateMeta(option)}</span>
      </span>
    </DateCard>
  );
}
