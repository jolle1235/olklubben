import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlusIcon, PencilIcon, PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { ArchivedPlaceBanner } from "@/components/features/places/archived-place-banner";
import { PlaceAbout } from "@/components/features/places/place-about";
import { PlaceEvents } from "@/components/features/places/place-events";
import { PlaceOwners } from "@/components/features/places/place-owners";
import { RemovePlaceButton } from "@/components/features/places/remove-place-button";
import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { PageHeader } from "@/components/ui/page-header";
import { formatCompactDate, toDateKey } from "@/lib/format/date";
import { getDisplayName } from "@/lib/format/display-name";
import { editPlaceHref, newEventHref } from "@/lib/routes";
import { isAdmin } from "@/server/domain/clubs/permissions";
import {
  canEditPlace,
  canRemovePlace,
  canRestorePlace,
  placeRemoval,
} from "@/server/domain/places/permissions";
import { listEventsAtPlace } from "@/server/events/queries";
import { requirePlace, requirePlacePage } from "@/server/places/access";

export async function generateMetadata({
  params,
}: PageProps<"/c/[clubId]/places/[placeId]">): Promise<Metadata> {
  const { clubId, placeId } = await params;
  // Cached with the guard layout's call; never writes.
  const { place } = await requirePlace(clubId, placeId);
  return { title: place.name };
}

/**
 * One place (SPEC §9.4, D-100, D-101, D-107): address with "Åbn i kort",
 * description, "Opret event her" (the primary action of an active place),
 * the owners with the "Det er mit sted" toggle, "Ølsmagninger her", and
 * Rediger plus ONE removal button labelled by what will happen. An archived
 * place shows a banner with "Gendan sted" instead of "Opret event her".
 *
 * The guard layout has already given a real 404 for a place that is not in
 * this club (E22); requirePlacePage() returns it with its owners and
 * remembers the active club.
 */
export default async function PlacePage({ params }: PageProps<"/c/[clubId]/places/[placeId]">) {
  const { clubId, placeId } = await params;
  const { user, membership, club, place } = await requirePlacePage(clubId, placeId);
  const events = await listEventsAtPlace(club.id, place.id);

  const now = new Date();
  const archived = place.archivedAt !== null;
  const usage = { eventCount: place.eventCount };
  const createHref = newEventHref(club.id, { placeId: place.id });
  const editHref = editPlaceHref(club.id, place.id);
  const canRemove = canRemovePlace(membership, place, user.id, usage);
  const viewer = { id: user.id, name: user.name, nickname: user.nickname, image: user.image };

  return (
    <>
      {archived ? null : (
        <TopBarAction>
          <Button asChild size="icon" variant="brass">
            <Link href={createHref} aria-label="Opret event her">
              <PlusIcon aria-hidden />
            </Link>
          </Button>
        </TopBarAction>
      )}

      <PageHeader
        title={place.name}
        action={
          archived ? undefined : (
            <Button asChild>
              <Link href={createHref}>
                <CalendarPlusIcon aria-hidden />
                Opret event her
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="grid grid-cols-1 content-start gap-8">
          {archived ? (
            <ArchivedPlaceBanner
              clubId={club.id}
              placeId={place.id}
              canRestore={canRestorePlace(membership, place, user.id)}
            />
          ) : null}
          <PlaceAbout address={place.address} description={place.description} editHref={editHref} />
          <PlaceOwners
            clubId={club.id}
            placeId={place.id}
            placeName={place.name}
            owners={place.owners}
            viewer={viewer}
            canRemoveOthers={isAdmin(membership)}
          />
        </div>

        <div className="grid grid-cols-1 content-start gap-8">
          <PlaceEvents clubId={club.id} events={events} now={now} />

          <section aria-label="Administrer stedet" className="grid grid-cols-1 gap-3">
            <p className="text-[0.95rem] break-words text-muted-foreground">
              Oprettet af {getDisplayName(place.createdBy)} ·{" "}
              <time dateTime={toDateKey(place.createdAt)}>
                {formatCompactDate(place.createdAt)}
              </time>
            </p>
            <div className="flex flex-wrap gap-3">
              {canEditPlace(membership) ? (
                <Button asChild variant="outline">
                  <Link href={editHref}>
                    <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
                    Rediger
                  </Link>
                </Button>
              ) : null}
              {canRemove ? (
                <RemovePlaceButton
                  clubId={club.id}
                  placeId={place.id}
                  placeName={place.name}
                  removal={placeRemoval(usage)}
                  eventCount={place.eventCount}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
