import type { Metadata } from "next";

import { BeerForm } from "@/components/features/beers/beer-form";
import { toEventChoices } from "@/components/features/beers/catalog-view";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { beersHref, eventHref } from "@/lib/routes";
import { firstParam } from "@/lib/search-params";
import { requireClubPage } from "@/server/auth/session";
import { listBeerNames } from "@/server/beers/queries";
import { BEER_NAME_MAX_LENGTH, cleanBeerName } from "@/server/domain/beers/name";
import { listEventOptions } from "@/server/events/queries";

export const metadata: Metadata = { title: "Tilføj øl" };

/**
 * Tilføj øl (SPEC §9.5, §10.5). ?eventId= preselects one of the club's events
 * (from the event page's "+ Tilføj øl" or a filtered catalogue); an unknown or
 * other-club id is ignored – never notFound() here, this page sits below
 * beers/new/loading.tsx (TG-008). ?name= prefills the name (the catalogue's
 * "Tilføj som ny øl" after a search without matches).
 */
export default async function NewBeerPage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/beers/new">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);

  const [events, existingBeers, query] = await Promise.all([
    listEventOptions(club.id),
    listBeerNames(club.id),
    searchParams,
  ]);
  const requestedEventId = firstParam(query.eventId) ?? "";
  const event = events.find((option) => option.id === requestedEventId) ?? null;
  const name = cleanBeerName(firstParam(query.name) ?? "").slice(0, BEER_NAME_MAX_LENGTH);

  return (
    <>
      <PageHeader
        title="Tilføj øl"
        description={
          event
            ? `Til ${event.title}. Bagefter kan du give den stjerner.`
            : "Navn og alkoholprocent. Bagefter kan du give den stjerner."
        }
      />
      <Card className="max-w-2xl">
        <CardContent>
          <BeerForm
            mode="create"
            clubId={club.id}
            defaults={{ name, abv: "", eventId: event?.id ?? "" }}
            events={toEventChoices(events)}
            existingBeers={existingBeers}
            cancelHref={event ? eventHref(club.id, event.id) : beersHref(club.id)}
          />
        </CardContent>
      </Card>
    </>
  );
}
