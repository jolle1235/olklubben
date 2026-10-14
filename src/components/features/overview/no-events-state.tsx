import Link from "next/link";
import { CalendarDaysIcon, PlusIcon, VoteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export type NoEventsStateProps = {
  newEventHref: string;
  newPollHref: string;
  /**
   * Show "Opret event" as a secondary (outline) button, when something else on
   * the screen is the primary action, e.g. the invitation card's "Del" while
   * the club has one member. One primary action per screen (SPEC §13.4, D-057).
   */
  deemphasize?: boolean;
};

/**
 * Overblik with no upcoming or ongoing event AND no active poll (SPEC §9.1
 * empty states, §13.5): [Opret event] and [Planlæg ølsmagning] (round 4,
 * D-137). The poll button is always the quieter one.
 */
export function NoEventsState({
  newEventHref,
  newPollHref,
  deemphasize = false,
}: NoEventsStateProps) {
  return (
    <EmptyState
      icon={<CalendarDaysIcon />}
      title="Ingen kommende ølsmagninger endnu 🍺"
      description="Sæt en dato i kalenderen – eller lad klubben stemme om, hvornår og hvor."
      actions={
        <>
          <Button
            asChild
            size={deemphasize ? "default" : "lg"}
            variant={deemphasize ? "outline" : "default"}
          >
            <Link href={newEventHref}>
              <PlusIcon aria-hidden />
              Opret event
            </Link>
          </Button>
          <Button asChild size={deemphasize ? "default" : "lg"} variant="outline">
            <Link href={newPollHref}>
              <VoteIcon aria-hidden />
              Planlæg ølsmagning
            </Link>
          </Button>
        </>
      }
    />
  );
}

export type PlanActionsProps = {
  newEventHref: string;
  newPollHref: string;
  className?: string;
};

/**
 * [+ Opret event] [🗳 Planlæg ølsmagning] as quiet outline buttons: under
 * "Kommende arrangementer", and on Overblik when the club has active polls
 * but no event yet (the poll cards are the screen's content then).
 */
export function PlanActions({ newEventHref, newPollHref, className }: PlanActionsProps) {
  return (
    <div className={className ?? "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"}>
      <Button asChild variant="outline">
        <Link href={newEventHref}>
          <PlusIcon aria-hidden />
          Opret event
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={newPollHref}>
          <VoteIcon aria-hidden />
          Planlæg ølsmagning
        </Link>
      </Button>
    </div>
  );
}
