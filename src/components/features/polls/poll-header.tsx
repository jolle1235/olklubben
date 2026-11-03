import { ClockIcon, EyeIcon, VoteIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatWeekdayDateTime } from "@/lib/format/date";
import { getDisplayName } from "@/lib/format/display-name";
import type { PollView } from "@/server/polls/queries";

import { pollStatusLabel, timeLeftLabel } from "./poll-labels";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PollHeaderProps = {
  view: PollView;
  /** The request's time (the countdown and the "under 24 h" highlight). */
  now: Date;
};

/**
 * The top of the poll page (SPEC §9.7.3, D-014, D-136): "🗳 Afstemning" and a
 * status badge (highlight "Frist om 5 timer" under 24 hours), the title (the
 * page's only h1), the theme pill, who started it, the deadline with the time
 * left, the plan, and the note that votes are open to the whole club. Server
 * Component; the page composes it above the vote form or the results.
 */
export function PollHeader({ view, now }: PollHeaderProps) {
  const open = view.status === "OPEN";
  const msLeft = view.deadline.getTime() - now.getTime();
  const soon = open && msLeft > 0 && msLeft < DAY_MS;
  const creator = getDisplayName(view.createdBy);

  return (
    <header className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">
          <VoteIcon aria-hidden />
          Afstemning
        </Badge>
        {open ? (
          soon ? (
            <Badge variant="highlight">{timeLeftLabel(view.deadline, now)}</Badge>
          ) : null
        ) : (
          <Badge variant={view.status === "CANCELLED" ? "outline" : "secondary"}>
            {pollStatusLabel(view.status)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <h1 className="text-headline-md font-bold break-words hyphens-auto text-primary-ink md:text-headline-lg">
          {view.title}
        </h1>
        {view.theme ? (
          <p className="w-fit max-w-full rounded-2xl border border-highlight-border bg-highlight-subtle px-4 py-1.5 text-lead break-words hyphens-auto text-foreground">
            <span className="font-semibold">Tema:</span> {view.theme}
          </p>
        ) : null}
        <p className="text-body-sm break-words text-muted-foreground">
          Startet af <span className="font-semibold text-foreground">{creator}</span>
          {view.createdBy.isMember ? null : " (tidligere medlem)"}
        </p>
      </div>

      <p className="flex items-start gap-2 text-lead text-foreground">
        <ClockIcon aria-hidden className="mt-1 size-4 shrink-0 text-primary-ink" />
        <span className="min-w-0 break-words">
          {open ? (
            <>
              <span className="font-semibold">{timeLeftLabel(view.deadline, now)}</span>
              {" · "}
            </>
          ) : (
            "Frist: "
          )}
          <time dateTime={view.deadline.toISOString()}>{formatWeekdayDateTime(view.deadline)}</time>
        </span>
      </p>

      {view.description ? (
        <section aria-labelledby="poll-plan-heading" className="grid grid-cols-1 gap-1">
          <h2 id="poll-plan-heading" className="text-body-lg font-semibold text-foreground">
            Planen
          </h2>
          <p className="break-words hyphens-auto whitespace-pre-line text-foreground">
            {view.description}
          </p>
        </section>
      ) : null}

      <p className="flex items-start gap-2 rounded-xl bg-info-subtle px-3.5 py-2.5 text-body-sm text-info-ink">
        <EyeIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          Stemmerne er åbne: alle i klubben kan se, hvem der har stemt på hvad.
        </span>
      </p>
    </header>
  );
}
