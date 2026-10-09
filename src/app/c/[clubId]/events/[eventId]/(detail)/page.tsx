import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon, PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { EventBeerList } from "@/components/features/events/event-beer-list";
import { EventInvitation } from "@/components/features/events/event-invitation";
import { EventManageActions } from "@/components/features/events/event-manage-actions";
import { EventSection } from "@/components/features/events/event-section";
import { eventPrimaryAction } from "@/components/features/events/primary-action";
import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { getDisplayName } from "@/lib/format/display-name";
import { editEventHref, newBeerHref } from "@/lib/routes";
import { canDeleteEvent, canEditEvent } from "@/server/domain/events/permissions";
import { requireEvent, requireEventPage } from "@/server/events/access";
import { getEventBeers } from "@/server/events/queries";

export async function generateMetadata({
  params,
}: PageProps<"/c/[clubId]/events/[eventId]">): Promise<Metadata> {
  const { clubId, eventId } = await params;
  // Cached with the guard layout's call; never writes.
  const { event } = await requireEvent(clubId, eventId);
  return { title: event.title };
}

/**
 * Event detail, "som en invitation, ikke en formular" (SPEC §9.2): the
 * invitation, Rediger/Slet for the creator and admins (D-061), the plan and
 * the beers tasted at the event.
 *
 * The guard layout has already given a real 404 for an event that is not in
 * this club (E22, TG-008); requireEventPage() returns it and remembers the
 * active club (D-052).
 */
export default async function EventPage({ params }: PageProps<"/c/[clubId]/events/[eventId]">) {
  const { clubId, eventId } = await params;
  const { user, membership, club, event } = await requireEventPage(clubId, eventId);
  const beers = await getEventBeers(club.id, event.id, user.id);

  const now = new Date();
  const canEdit = canEditEvent(membership, event, user.id);
  const canDelete = canDeleteEvent(membership, event, user.id);
  const primary = eventPrimaryAction(event, now, canEdit);
  const editHref = editEventHref(club.id, event.id);
  const addBeerHref = newBeerHref(club.id, { eventId: event.id });

  return (
    <>
      <TopBarAction>
        {primary === "edit" ? (
          <Button asChild size="icon" variant="brass">
            <Link href={editHref} aria-label="Rediger event">
              <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
            </Link>
          </Button>
        ) : (
          <Button asChild size="icon" variant="brass">
            <Link href={addBeerHref} aria-label="Tilføj øl">
              <PlusIcon aria-hidden />
            </Link>
          </Button>
        )}
      </TopBarAction>

      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <EventInvitation event={event} creatorName={getDisplayName(event.createdBy)} now={now} />

        <EventManageActions
          clubId={club.id}
          eventId={event.id}
          title={event.title}
          editHref={editHref}
          canEdit={canEdit}
          canDelete={canDelete}
          emphasizeEdit={primary === "edit"}
        />

        {event.description ? (
          <EventSection id="event-plan" title="Planen">
            {/* Plain text: React escapes it, line breaks are kept (never HTML). */}
            <p className="mx-auto w-full max-w-[60ch] text-[1.1rem] leading-relaxed break-words hyphens-auto whitespace-pre-line text-ink">
              {event.description}
            </p>
          </EventSection>
        ) : null}

        <EventSection id="event-beers" title="Øl smagt til dette event">
          <EventBeerList
            clubId={club.id}
            beers={beers}
            addBeerHref={addBeerHref}
            emphasizeAdd={primary === "addBeer"}
          />
        </EventSection>
      </div>
    </>
  );
}
