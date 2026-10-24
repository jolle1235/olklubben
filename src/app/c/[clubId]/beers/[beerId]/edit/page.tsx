import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BeerForm } from "@/components/features/beers/beer-form";
import { toEventChoices } from "@/components/features/beers/catalog-view";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { beerHref, beerImageHref } from "@/lib/routes";
import { rememberActiveClub } from "@/server/auth/session";
import { requireBeer } from "@/server/beers/access";
import { listBeerNames } from "@/server/beers/queries";
import { abvToInputValue } from "@/server/domain/beers/abv";
import { canEditBeer } from "@/server/domain/beers/permissions";
import { listEventOptions } from "@/server/events/queries";

export const metadata: Metadata = { title: "Rediger øl" };

/**
 * Rediger øl (SPEC §9.5, §5.1, D-063): name, ABV and event.
 *
 * Only the creator or an admin; anyone else gets a real 404 (no loading.tsx
 * above this page, TG-008). The guard layout has already checked that the
 * beer is in this club. Like the other 404s (D-066), the permission 404 comes
 * before the active club changes. The Server Action checks again.
 */
export default async function EditBeerPage({
  params,
}: PageProps<"/c/[clubId]/beers/[beerId]/edit">) {
  const { clubId, beerId } = await params;
  const { user, membership, club, beer } = await requireBeer(clubId, beerId);
  if (!canEditBeer(membership, beer, user.id)) notFound();
  await rememberActiveClub(user, club.id);

  const [events, beerNames] = await Promise.all([
    listEventOptions(club.id),
    listBeerNames(club.id),
  ]);

  return (
    <>
      <PageHeader
        title="Rediger øl"
        description={<span className="break-words hyphens-auto">{beer.name}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <BeerForm
            mode="edit"
            clubId={club.id}
            beerId={beer.id}
            defaults={{
              name: beer.name,
              abv: abvToInputValue(beer.abv),
              eventId: beer.eventId ?? "",
            }}
            events={toEventChoices(events)}
            existingBeers={beerNames.filter((other) => other.id !== beer.id)}
            cancelHref={beerHref(club.id, beer.id)}
            currentImageUrl={beerImageHref(club.id, beer.id, beer.imageVersion)}
          />
        </CardContent>
      </Card>
    </>
  );
}
