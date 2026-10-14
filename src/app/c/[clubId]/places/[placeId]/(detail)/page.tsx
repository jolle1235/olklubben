import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, CalendarPlusIcon, PencilIcon, PlusIcon, VoteIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { ArchivedPlaceBanner } from "@/components/features/places/archived-place-banner";
import { PlaceAbout } from "@/components/features/places/place-about";
import { PlaceEvents } from "@/components/features/places/place-events";
import { PlaceOwners } from "@/components/features/places/place-owners";
import { placeInActivePollNote } from "@/components/features/places/place-labels";
import { RemovePlaceButton } from "@/components/features/places/remove-place-button";
import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { PageHeader } from "@/components/ui/page-header";
import { formatCompactDate, toDateKey } from "@/lib/format/date";
import { getDisplayName } from "@/lib/format/display-name";
import { editPlaceHref, newEventHref, placesHref, pollHref } from "@/lib/routes";
import { isAdmin } from "@/server/domain/clubs/permissions";
import {
  canEditPlace,
  canRemovePlace,
  canRestorePlace,
  placeRemoval,
  placeRemovalBlock,
} from "@/server/domain/places/permissions";
import { listEventsAtPlace } from "@/server/events/queries";
import { requirePlace, requirePlacePage } from "@/server/places/access";
import { placeUsageOf } from "@/server/places/queries";

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
 * Rediger plus ONE removal button labelled by what will happen – or, while
 * the place is in an open or tied poll, a note linking to it (E5). An archived
 * place shows a banner with "Gendan sted" instead of "Opret event her".
 * Steder has no main navigation item (§8.1), so the page links back to it.
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
  const usage = placeUsageOf(place);
  // E5 (D-132): a place in a poll that is not finished can be neither archived nor deleted.
  const [blockingPoll] = placeRemovalBlock(usage) !== null ? place.activePolls : [];
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

      <Link
        href={placesHref(club.id)}
        className="mb-1 -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-olive underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Alle steder
      </Link>
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
                  usage={usage}
                />
              ) : null}
            </div>
            {blockingPoll && !archived ? (
              <p className="flex items-start gap-2 text-[0.95rem] break-words text-muted-foreground">
                <VoteIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-harbor" />
                <span className="min-w-0">
                  {placeInActivePollNote(blockingPoll.title)}{" "}
                  <Link
                    href={pollHref(club.id, blockingPoll.id)}
                    className="inline-flex min-h-11 items-center font-semibold text-olive underline underline-offset-4"
                  >
                    Se afstemningen
                  </Link>
                </span>
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
