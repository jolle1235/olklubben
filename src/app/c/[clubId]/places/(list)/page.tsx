import type { Metadata } from "next";
import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { placeHref } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { listPlaces } from "@/server/places/queries";

export const metadata: Metadata = { title: "Steder" };

/**
 * Steder (SPEC §9.4, D-095, D-108): the club's places, active and archived.
 *
 * A list that never calls notFound() itself, so its loading.tsx may sit next
 * to it. Both live in the (list) route group, so the boundary does not wrap
 * places/new or places/[placeId] (TG-008).
 *
 * STUB (round-3 foundation): a plain list of the active places so the routes
 * can be reached; agent B replaces the body (cards, owners, archived places,
 * "＋ Nyt sted").
 */
export default async function PlacesPage({ params }: PageProps<"/c/[clubId]/places">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);
  const { active } = await listPlaces(club.id);

  return (
    <>
      <PageHeader
        title="Steder"
        description="Hvor I mødes. Ejerne bliver værter, når stedet bruges til en smagning."
      />
      {active.length === 0 ? (
        <EmptyState icon={<MapPinIcon />} title="Ingen steder endnu 📍" />
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {active.map((place) => (
            <li key={place.id}>
              <Link
                href={placeHref(club.id, place.id)}
                className="flex min-h-11 items-center rounded-lg px-1 text-lg break-words hyphens-auto text-olive underline-offset-4 hover:underline"
              >
                {place.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
