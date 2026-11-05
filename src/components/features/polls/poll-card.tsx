import Link from "next/link";
import { ArrowRightIcon, VoteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { eventHref, pollHref, pollVoteHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { OverviewPollItem } from "@/server/polls/queries";

import {
  hostsLabel,
  leaderLabel,
  pollCardHeadline,
  pollCardMeta,
  pollCardState,
  type PollCardState,
} from "./decision-labels";

export type PollCardProps = {
  clubId: string;
  poll: OverviewPollItem;
  viewerId: string;
  /** canManagePoll for this poll (the tie card's "Vælg vinder"). */
  canManage: boolean;
  now: Date;
};

/** The states that ask the viewer to act get the highlight button and ring. */
function needsViewer(state: PollCardState): boolean {
  return state === "missing" || state === "tie-manager";
}

/**
 * One poll on Overblik (SPEC §9.1 "Aktive afstemninger", D-137), right under
 * the hero: a dashed info card (polls are dashed everywhere, confirmed
 * events are filled) with the poll's title and one of five states –
 *
 *   missing      "Du mangler at stemme" (highlight ring) · frist · N af M · [Stem nu]
 *   voted        "Du har stemt ✓" · frist · N af M · "Fører lige nu: …"
 *   tie-manager  "Uafgjort 🤝 – du skal vælge vinderen" · [Vælg vinder]
 *   tie-waiting  "Uafgjort 🤝 – Mads eller en admin vælger"
 *   decided      "🎉 Afgjort: lørdag 21. november · Hos Mads" · Vært · [Se event]
 *
 * The heading is the card's name for screen readers; the state line follows.
 */
export function PollCard({ clubId, poll, viewerId, canManage, now }: PollCardProps) {
  void viewerId;
  const state = pollCardState(poll, canManage);
  const urgent = needsViewer(state);
  const creator = { name: poll.creatorName, isMember: poll.creatorIsMember };
  const headingId = `poll-card-${poll.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "grid grid-cols-1 gap-3 rounded-2xl border-2 border-dashed border-info-border bg-card px-5 py-4 sm:px-6 sm:py-5",
        urgent && "ring-[3px] ring-highlight ring-offset-2 ring-offset-background",
      )}
    >
      <h2
        id={headingId}
        className="flex items-start gap-2 text-label-md font-bold caps text-info-ink"
      >
        <VoteIcon aria-hidden className="mt-px size-4 shrink-0" />
        <span className="min-w-0 break-words hyphens-auto">
          Afstemning:{" "}
          <span className="font-heading text-body-md tracking-normal normal-case">
            {poll.title}
          </span>
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-1">
        <p
          className={cn(
            "text-title-sm font-bold break-words hyphens-auto",
            urgent ? "text-highlight-ink" : "text-foreground",
          )}
        >
          {pollCardHeadline(state, creator, poll.event, now)}
        </p>
        <CardMeta poll={poll} state={state} now={now} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {state === "missing" ? (
          <Button asChild variant="highlight" className="w-full sm:w-auto">
            <Link href={pollVoteHref(clubId, poll.id)}>
              Stem nu
              <ArrowRightIcon aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        ) : null}
        {state === "tie-manager" ? (
          <Button asChild variant="highlight" className="w-full sm:w-auto">
            <Link href={pollHref(clubId, poll.id)}>
              Vælg vinder
              <ArrowRightIcon aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        ) : null}
        {state === "voted" || state === "tie-waiting" ? (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={pollHref(clubId, poll.id)}>Se afstemningen</Link>
          </Button>
        ) : null}
        {state === "decided" && poll.event ? (
          <>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={eventHref(clubId, poll.event.id)}>
                Se event
                <ArrowRightIcon aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
            <Link
              href={pollHref(clubId, poll.id)}
              className="inline-flex min-h-11 items-center self-center px-2 text-body-sm font-semibold text-primary-ink underline decoration-2 underline-offset-4 pressable-dim hover:decoration-highlight"
            >
              Se afstemningen
            </Link>
          </>
        ) : null}
      </div>
    </section>
  );
}

function CardMeta({
  poll,
  state,
  now,
}: {
  poll: OverviewPollItem;
  state: PollCardState;
  now: Date;
}) {
  const line = "text-lead break-words hyphens-auto text-muted-foreground";
  switch (state) {
    case "missing":
      return <p className={line}>{pollCardMeta(poll, now)}</p>;
    case "voted":
      return (
        <>
          <p className={line}>{pollCardMeta(poll, now)}</p>
          <p className="text-lead font-semibold break-words hyphens-auto text-foreground">
            {leaderLabel(poll.leader)}
          </p>
        </>
      );
    case "tie-manager":
    case "tie-waiting":
      return (
        <p className={line}>
          {poll.votedCount} af {poll.memberCount} stemte
        </p>
      );
    case "decided":
      return poll.event ? <p className={line}>{hostsLabel(poll.event.hostNames)}</p> : null;
  }
}
