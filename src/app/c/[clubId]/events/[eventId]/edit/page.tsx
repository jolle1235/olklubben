import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventForm } from "@/components/features/events/event-form";
import { eventHref } from "@/lib/routes";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { rememberActiveClub } from "@/server/auth/session";
import { canEditEvent } from "@/server/domain/events/permissions";
import { eventTimesToFormValues } from "@/server/domain/events/time";
import { requireEvent } from "@/server/events/access";

export const metadata: Metadata = { title: "Rediger event" };

/**
 * Edit an event (SPEC §9.2, D-098): the creator, a host or an admin. Anyone else gets
 * a real 404 – there is no loading.tsx above this page (TG-008). The guard
 * layout has already checked that the event is in this club. Like the other
 * 404s (D-066), the permission 404 comes before the active club changes.
 *
 * Times come back as Copenhagen wall-clock values; an end on the next day
 * shows as an earlier time, which the overnight rule reads the same way.
 */
export default async function EditEventPage({
  params,
}: PageProps<"/c/[clubId]/events/[eventId]/edit">) {
  const { clubId, eventId } = await params;
  const { user, membership, club, event } = await requireEvent(clubId, eventId);
  if (!canEditEvent(membership, event, user.id)) notFound();
  await rememberActiveClub(user, club.id);

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
            defaults={{
              title: event.title,
              ...eventTimesToFormValues(event),
              newPlaceName: event.place.name,
              theme: event.theme ?? "",
              description: event.description ?? "",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
