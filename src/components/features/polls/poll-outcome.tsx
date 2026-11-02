import Link from "next/link";
import { ArrowRightIcon, MapPinIcon, UsersIcon } from "lucide-react";

import { BigDate } from "@/components/ui/big-date";
import { Button } from "@/components/ui/button";
import { getDisplayName } from "@/lib/format/display-name";
import { eventHref } from "@/lib/routes";
import type { PollView } from "@/server/polls/queries";

import {
  EVENT_DELETED_NOTE,
  hostsLabel,
  outcomeDateLabel,
  resolvedByLabel,
} from "./decision-labels";
import { closeReasonLabel } from "./poll-labels";

export type PollOutcomeProps = {
  clubId: string;
  /** A CLOSED poll. */
  view: PollView;
  now: Date;
};

/**
 * "🎉 Afstemningen er afsluttet!" (SPEC §9.7.7): the event the poll created,
 * in the hero card's look (surface-feature, the big date): date and time, place,
 * hosts, why voting ended and who chose after a tie, and [Se event]. The
 * event is an ordinary event afterwards, so it shows its CURRENT date and
 * place; if it was deleted, the card says so and has no button.
 */
export function PollOutcome({ clubId, view, now }: PollOutcomeProps) {
  const { event } = view;
  const reason = [
    closeReasonLabel(view),
    resolvedByLabel(
      view.tieResolutions.map((resolution) => ({
        category: resolution.category,
        chosenByName: getDisplayName(resolution.chosenBy),
      })),
    ),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      aria-labelledby="poll-outcome-heading"
      className="relative isolate animate-in overflow-hidden rounded-2xl surface-feature px-5 pt-5 pb-6 shadow-hero duration-500 fade-in sm:px-7"
    >
      <h2
        id="poll-outcome-heading"
        className="text-[1.6rem] leading-tight font-bold break-words text-feature-foreground md:text-[1.85rem]"
      >
        🎉 Afstemningen er afsluttet!
      </h2>

      {event ? (
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
          <div aria-hidden>
            <BigDate date={event.startsAt} size="md" className="text-feature-foreground" />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2">
            <p className="text-xl font-semibold break-words text-feature-foreground">
              <time dateTime={event.startsAt.toISOString()}>
                {outcomeDateLabel(event.startsAt, now)}
              </time>
            </p>
            <p className="flex items-start gap-2.5 text-lg text-feature-foreground">
              <MapPinIcon aria-hidden className="mt-1 size-5 shrink-0 text-highlight" />
              <span className="min-w-0 break-words hyphens-auto">
                <span className="sr-only">Sted: </span>
                {event.placeName}
              </span>
            </p>
            <p className="flex items-start gap-2.5 text-lg text-feature-foreground">
              <UsersIcon aria-hidden className="mt-1 size-5 shrink-0 text-highlight" />
              <span className="min-w-0 break-words hyphens-auto">
                {hostsLabel(event.hosts.map((host) => getDisplayName(host)))}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-lg text-feature-foreground">{EVENT_DELETED_NOTE}</p>
      )}

      {reason ? (
        <p className="mt-4 text-[0.95rem] break-words text-feature-muted-foreground">{reason}</p>
      ) : null}

      {event ? (
        <Button asChild variant="highlight" size="lg" className="mt-5 w-full sm:w-fit">
          <Link href={eventHref(clubId, event.id)}>
            Se event
            <ArrowRightIcon aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}
