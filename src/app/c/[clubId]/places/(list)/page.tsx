import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { PlaceList } from "@/components/features/places/place-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { newPlaceHref as newPlacePath } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { listPlaces } from "@/server/places/queries";

export const metadata: Metadata = { title: "Steder" };

/**
 * Steder (SPEC §9.4, D-095, D-100): where the club meets. The active places
 * as cards (owners, how often used, "Dit sted"), the archived ones folded
 * away, "＋ Nyt sted" as the screen's primary action (the top bar's + on
 * phones).
 *
 * A list that never calls notFound() itself, so its loading.tsx may sit next
 * to it. Both live in the (list) route group, so the boundary does not wrap
 * places/new or places/[placeId] (TG-008, D-108).
 */
export default async function PlacesPage({ params }: PageProps<"/c/[clubId]/places">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);
  const { active, archived } = await listPlaces(club.id);
  const newPlaceHref = newPlacePath(club.id);

  return (
    <>
      <TopBarAction>
        <Button asChild size="icon" variant="brass">
          <Link href={newPlaceHref} aria-label="Nyt sted">
            <PlusIcon aria-hidden />
          </Link>
        </Button>
      </TopBarAction>

      <PageHeader
        title="Steder"
        description="Hvor I mødes. Ejerne bliver værter, når stedet bruges til en smagning."
        action={
          active.length === 0 ? undefined : (
            <Button asChild className="hidden md:inline-flex">
              <Link href={newPlaceHref}>
                <PlusIcon aria-hidden />
                Nyt sted
              </Link>
            </Button>
          )
        }
      />

      <PlaceList
        clubId={club.id}
        active={active}
        archived={archived}
        viewerId={user.id}
        newPlaceHref={newPlaceHref}
      />
    </>
  );
}
