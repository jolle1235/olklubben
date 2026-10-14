import Link from "next/link";
import { VoteIcon } from "lucide-react";

import { formatTime } from "@/lib/format/date";
import { pollHref } from "@/lib/routes";

import { pollDateAccessibleName, type CalendarPollDate } from "./event-format";

export type PollOptionChipProps = {
  clubId: string;
  option: CalendarPollDate;
  now: Date;
};

/**
 * A possible poll date in a desktop month cell (SPEC §9.3, D-137): dashed
 * harbor border, transparent, "🗳 Ølsmagning #15" and the time – the same
 * readable size as EventChip, but never filled. The accessible name says
 * what it is ("Mulig dato: Ølsmagning #15, lørdag 14. november kl. 18:30,
 * afstemning, stem inden tirsdag 10. november"). The focus ring is drawn
 * inside (the month table clips its cells, F-029).
 */
export function PollOptionChip({ clubId, option, now }: PollOptionChipProps) {
  return (
    <Link
      href={pollHref(clubId, option.pollId)}
      title={`${option.pollTitle} (afstemning)`}
      aria-label={pollDateAccessibleName(option, now)}
      className="block rounded-md border-[1.5px] border-dashed border-harbor/70 bg-transparent px-1.5 py-1 text-harbor transition-colors hover:bg-harbor-tint/60 focus-visible:-outline-offset-3"
    >
      <span className="flex items-start gap-1">
        <VoteIcon aria-hidden className="mt-px size-3.5 shrink-0" />
        <span className="line-clamp-3 min-w-0 text-sm leading-tight font-semibold break-words hyphens-auto">
          {option.pollTitle}
        </span>
      </span>
      <span className="mt-0.5 block text-[0.8125rem] leading-tight text-slate tabular-nums">
        {formatTime(option.startsAt)}
        {option.viewerTicked ? " · Du kan ✓" : ""}
      </span>
    </Link>
  );
}
