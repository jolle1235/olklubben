import Link from "next/link";
import { ChevronDownIcon, MapPinIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { placeHref } from "@/lib/routes";

import { PlaceCard, type PlaceCardPlace } from "./place-card";

type ListedPlace = PlaceCardPlace & { id: string };

export type PlaceListProps = {
  clubId: string;
  /** By name (listPlaces). */
  active: readonly ListedPlace[];
  archived: readonly ListedPlace[];
  /** The viewer, for "Dit sted". */
  viewerId: string;
  newPlaceHref: string;
};

function Cards({
  clubId,
  places,
  viewerId,
  muted = false,
}: {
  clubId: string;
  places: readonly ListedPlace[];
  viewerId: string;
  muted?: boolean;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3">
      {places.map((place) => (
        <li key={place.id}>
          <PlaceCard
            place={place}
            href={placeHref(clubId, place.id)}
            isMine={place.owners.some((owner) => owner.id === viewerId)}
            muted={muted}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The club's places (SPEC §9.4): the active ones as cards, the archived ones
 * folded away in "Arkiverede steder (N)" (a native <details>, so it works
 * before hydration). Without active places: an empty state that invites the
 * first one.
 */
export function PlaceList({ clubId, active, archived, viewerId, newPlaceHref }: PlaceListProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {active.length > 0 ? (
        <Cards clubId={clubId} places={active} viewerId={viewerId} />
      ) : (
        <EmptyState
          icon={<MapPinIcon />}
          title={archived.length > 0 ? "Ingen aktive steder 📍" : "Ingen steder endnu 📍"}
          description="Hvor mødes I? Opret jeres faste steder, så er de klar, når I planlægger næste smagning."
          actions={
            <Button asChild size="lg">
              <Link href={newPlaceHref}>
                <PlusIcon aria-hidden />
                Nyt sted
              </Link>
            </Button>
          }
        />
      )}

      {archived.length > 0 ? (
        <details className="group/archived grid grid-cols-1 gap-3">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg font-heading text-lg font-semibold text-olive [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon
              aria-hidden
              className="size-5 shrink-0 transition-transform group-open/archived:rotate-180"
            />
            Arkiverede steder ({archived.length})
          </summary>
          <p className="mb-3 text-[0.95rem] text-muted-foreground">
            Vises ikke, når I vælger sted. De gamle events viser dem stadig.
          </p>
          <Cards clubId={clubId} places={archived} viewerId={viewerId} muted />
        </details>
      ) : null}
    </div>
  );
}
