import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventForm } from "@/components/features/events/event-form";
import {
  hostFallbackFor,
  toHostChoices,
  toPlaceChoices,
} from "@/components/features/events/event-form-state";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { eventHref } from "@/lib/routes";
import { rememberActiveClub } from "@/server/auth/session";
import { listMemberOptions } from "@/server/clubs/queries";
import { canEditEvent } from "@/server/domain/events/permissions";
import { eventTimesToFormValues } from "@/server/domain/events/time";
import { requireEvent } from "@/server/events/access";
import { listPlaceOptions } from "@/server/places/queries";

export const metadata: Metadata = { title: "Rediger event" };

/**
 * Edit an event (SPEC §9.2, D-098): the creator, a host or an admin. Anyone
 * else gets a real 404 – there is no loading.tsx above this page (TG-008).
 * The guard layout has already checked that the event is in this club. Like
 * the other 404s (D-066, D-089), the permission 404 comes before the active
 * club changes.
 *
 * The event's place stays selectable even when it has been archived since
 * (E30), and hosts who have left the club show as ticked chips that may stay
 * (§7.4). Times come back as Copenhagen wall-clock values; an end on the next
 * day shows as an earlier time, which the overnight rule reads the same way.
 */
export default async function EditEventPage({
  params,
}: PageProps<"/c/[clubId]/events/[eventId]/edit">) {
  const { clubId, eventId } = await params;
  const { user, membership, club, event } = await requireEvent(clubId, eventId);
  if (!canEditEvent(membership, event, user.id)) notFound();
  await rememberActiveClub(user, club.id);

  const [places, members] = await Promise.all([
    listPlaceOptions(club.id, { includePlaceId: event.place.id }),
    listMemberOptions(club.id),
  ]);
  const memberIds = new Set(members.map((member) => member.id));

  return (
    <>
      <PageHeader
        title="Rediger event"
        description={<span className="break-words hyphens-auto">{event.title}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <EventForm
            clubId={club.id}
            eventId={event.id}
            cancelHref={eventHref(club.id, event.id)}
            places={toPlaceChoices(places)}
            hostChoices={toHostChoices(
              members,
              event.hosts.filter((host) => !host.isMember),
            )}
            currentUserId={user.id}
            hostFallback={hostFallbackFor({ user, creator: event.createdBy, memberIds })}
            defaults={{
              title: event.title,
              ...eventTimesToFormValues(event),
              theme: event.theme ?? "",
              description: event.description ?? "",
              placeId: event.place.id,
              hostIds: event.hostIds,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
