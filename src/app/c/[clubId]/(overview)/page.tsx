import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { NextEventHero } from "@/components/features/overview/next-event-hero";
import { NoEventsState, PlanActions } from "@/components/features/overview/no-events-state";
import { PastEvents } from "@/components/features/overview/past-events";
import { UpcomingEvents } from "@/components/features/overview/upcoming-events";
import { PollCard } from "@/components/features/polls/poll-card";
import { Button } from "@/components/ui/button";
import {
  newBeerHref,
  newEventHref as newEventPath,
  newPollHref as newPollPath,
} from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { OVERVIEW_HISTORY_LIMIT } from "@/server/domain/events/history";
import { heroState } from "@/server/domain/events/status";
import { getNextEvent, listPastEvents, listUpcomingEvents } from "@/server/events/queries";
import { canManagePoll } from "@/server/domain/polls/permissions";
import { closeDuePolls } from "@/server/polls/close";
import { listOverviewPolls } from "@/server/polls/queries";

export const metadata: Metadata = { title: "Overblik" };

/** How many events "Kommende arrangementer" lists under the hero (SPEC §9.1 shows three). */
const UPCOMING_LIMIT = 4;

/**
 * Overblik (SPEC §3.2, §9.1): the next event big and clear (NextEventHero),
 * the club's polls right under it (PollCard: "Du mangler at stemme", the
 * tie, "🎉 Afgjort", D-137), then "Kommende arrangementer" with [+ Opret
 * event] and [🗳 Planlæg ølsmagning]. Without an upcoming or ongoing event
 * and without an active poll: "Ingen kommende ølsmagninger endnu 🍺". Last, quietly, the
 * newest past tastings ("Tidligere ølsmagninger", §13.4.2, D-107). The
 * invitation lives on the club page (D-163). The top bar's + follows the
 * hero, like on the event page (D-080): "Tilføj øl" to the event while it is
 * on, else "Opret event".
 *
 * The h1 "Overblik" is for screen readers only: the first thing you SEE is
 * the next event (§3.2), the club's name is already in the top bar/sidebar,
 * and the hero's title is the h2. One h1 in every state.
 *
 * Polls that are due (deadline passed, or everyone has voted) are closed
 * lazily BEFORE the queries (closeDuePolls, D-131; never throws), so an event
 * a poll just created is in the hero on this very render. This page sits
 * under its own loading.tsx, so a Link prefetch never runs that write.
 *
 * Lives in the (overview) route group so its loading.tsx wraps only this page
 * (TG-008, see c/[clubId]/layout.tsx). The URL is still /c/[clubId].
 */
export default async function OverviewPage({ params }: PageProps<"/c/[clubId]">) {
  const { clubId } = await params;
  const { user, membership, club } = await requireClubPage(clubId);
  // One "now" per request, so the hero and the list agree (and match the queries).
  const now = new Date();
  // Lazy close first (D-131): a just-created event must show in the hero below.
  await closeDuePolls(club.id, now);

  const [nextEvent, pastEvents, polls] = await Promise.all([
    getNextEvent(club.id, now),
    listPastEvents(club.id, now, { limit: OVERVIEW_HISTORY_LIMIT }),
    listOverviewPolls(club.id, user.id, now),
  ]);
  const upcoming = nextEvent
    ? await listUpcomingEvents(club.id, now, { excludeId: nextEvent.id, limit: UPCOMING_LIMIT })
    : [];

  const newEventHref = newEventPath(club.id);
  const newPollHref = newPollPath(club.id);
  const pollCards = polls.map((poll) => ({
    poll,
    canManage: canManagePoll(membership, poll, user.id),
  }));
  // A poll that waits for THIS viewer (vote, or choose the winner) holds the
  // primary action, so the hero's [Se event] is quiet then (D-057).
  const pollFirst = pollCards.some(
    ({ poll, canManage }) =>
      (poll.status === "OPEN" && !poll.viewerHasVoted) ||
      (poll.status === "AWAITING_DECISION" && canManage),
  );
  const pollList =
    pollCards.length > 0 ? (
      <div className="grid grid-cols-1 gap-4">
        {pollCards.map(({ poll, canManage }) => (
          <PollCard
            key={poll.id}
            clubId={club.id}
            poll={poll}
            viewerId={user.id}
            canManage={canManage}
            now={now}
          />
        ))}
      </div>
    ) : null;
  // The hero's state with the same "now": while the event is on, its primary is "Tilføj øl".
  const ongoing = nextEvent !== null && heroState(nextEvent, now).kind === "ongoing";

  return (
    <>
      <TopBarAction>
        <Button asChild size="icon" variant="brass">
          {ongoing ? (
            <Link href={newBeerHref(club.id, { eventId: nextEvent.id })} aria-label="Tilføj øl">
              <PlusIcon aria-hidden />
            </Link>
          ) : (
            <Link href={newEventHref} aria-label="Opret event">
              <PlusIcon aria-hidden />
            </Link>
          )}
        </Button>
      </TopBarAction>

      <h1 className="sr-only">Overblik</h1>

      <div className="flex flex-col gap-8 md:gap-10">
        {nextEvent ? (
          <>
            <NextEventHero clubId={club.id} event={nextEvent} now={now} quiet={pollFirst} />
            {pollList}
            <UpcomingEvents
              clubId={club.id}
              events={upcoming}
              now={now}
              newEventHref={newEventHref}
              newPollHref={newPollHref}
            />
          </>
        ) : pollList ? (
          <>
            {pollList}
            <PlanActions newEventHref={newEventHref} newPollHref={newPollHref} />
          </>
        ) : (
          <NoEventsState newEventHref={newEventHref} newPollHref={newPollHref} />
        )}

        <PastEvents clubId={club.id} events={pastEvents} now={now} />
      </div>
    </>
  );
}
