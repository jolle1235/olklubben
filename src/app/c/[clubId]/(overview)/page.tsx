import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { InviteMembersCard } from "@/components/features/overview/invite-members-card";
import { NextEventHero } from "@/components/features/overview/next-event-hero";
import { NoEventsState } from "@/components/features/overview/no-events-state";
import { PastEvents } from "@/components/features/overview/past-events";
import { UpcomingEvents } from "@/components/features/overview/upcoming-events";
import { Button } from "@/components/ui/button";
import { inviteUrl } from "@/lib/app-url";
import { newBeerHref, newEventHref as newEventPath } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { countClubMembers, getActiveInviteCode } from "@/server/clubs/queries";
import { formatInviteCode } from "@/server/domain/clubs/invite-code";
import { OVERVIEW_HISTORY_LIMIT } from "@/server/domain/events/history";
import { heroState } from "@/server/domain/events/status";
import { getNextEvent, listPastEvents, listUpcomingEvents } from "@/server/events/queries";

export const metadata: Metadata = { title: "Overblik" };

/** How many events "Kommende arrangementer" lists under the hero (SPEC §9.1 shows three). */
const UPCOMING_LIMIT = 4;

/**
 * Overblik (SPEC §3.2, §9.1): the next event big and clear (NextEventHero),
 * then "Kommende arrangementer" and [+ Opret event]. Without an upcoming or
 * ongoing event: "Ingen kommende ølsmagninger endnu 🍺". Last, quietly, the
 * newest past tastings ("Tidligere ølsmagninger", §13.4.2, D-107). While the club has
 * only one member, "Inviter dine ølbrødre" comes first and its "Del" is the
 * screen's primary action (D-057). The top bar's + follows the hero, like
 * on the event page (D-080): "Tilføj øl" to the event while it is on, else
 * "Opret event".
 *
 * The h1 "Overblik" is for screen readers only: the first thing you SEE is
 * the next event (§3.2), the club's name is already in the top bar/sidebar,
 * and the hero's title is the h2. One h1 in every state.
 *
 * Lives in the (overview) route group so its loading.tsx wraps only this page
 * (TG-008, see c/[clubId]/layout.tsx). The URL is still /c/[clubId].
 */
export default async function OverviewPage({ params }: PageProps<"/c/[clubId]">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);
  // One "now" per request, so the hero and the list agree (and match the queries).
  const now = new Date();

  const [memberCount, nextEvent, pastEvents] = await Promise.all([
    countClubMembers(club.id),
    getNextEvent(club.id, now),
    listPastEvents(club.id, now, { limit: OVERVIEW_HISTORY_LIMIT }),
  ]);
  // The same "active invite" rule as the club page and /join (not revoked, not expired).
  const [inviteCode, upcoming] = await Promise.all([
    memberCount <= 1 ? getActiveInviteCode(club.id) : null,
    nextEvent
      ? listUpcomingEvents(club.id, now, { excludeId: nextEvent.id, limit: UPCOMING_LIMIT })
      : [],
  ]);

  const newEventHref = newEventPath(club.id);
  // While the invitation card shows, its "Del" is the primary action (D-057).
  const inviteFirst = inviteCode !== null;
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
        {inviteCode ? (
          <InviteMembersCard
            inviteUrl={inviteUrl(inviteCode)}
            displayCode={formatInviteCode(inviteCode)}
            clubName={club.name}
          />
        ) : null}

        {nextEvent ? (
          <>
            <NextEventHero clubId={club.id} event={nextEvent} now={now} quiet={inviteFirst} />
            <UpcomingEvents
              clubId={club.id}
              events={upcoming}
              now={now}
              newEventHref={newEventHref}
            />
          </>
        ) : (
          <NoEventsState newEventHref={newEventHref} deemphasize={inviteFirst} />
        )}

        <PastEvents clubId={club.id} events={pastEvents} now={now} />
      </div>
    </>
  );
}
