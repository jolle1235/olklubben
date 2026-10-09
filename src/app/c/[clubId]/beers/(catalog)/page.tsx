import type { Metadata } from "next";
import Link from "next/link";
import { BeerIcon, PlusIcon, SearchXIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { BeerCard } from "@/components/features/beers/beer-card";
import { CatalogControls } from "@/components/features/beers/catalog-controls";
import {
  catalogResultLabel,
  eventFilterOptions,
  resolveEventFilter,
  toEventChoices,
} from "@/components/features/beers/catalog-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { beerHref, beersHref, newBeerHref } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { listClubBeers } from "@/server/beers/queries";
import {
  beerCatalogSearch,
  EVENT_FILTER_ALL,
  EVENT_FILTER_NONE,
  filterBeers,
  isFilteredCatalog,
  parseBeerCatalogParams,
  sortBeers,
} from "@/server/domain/beers/catalog";
import { listEventOptions } from "@/server/events/queries";

export const metadata: Metadata = { title: "Ølkatalog" };

/**
 * Ølkatalog (SPEC §9.5 "Oversigt"): every beer of the club with the club's
 * rating and the member's own ("Din: –" = not rated yet). Search, sort and the
 * event filter live in the URL (?q=&sort=&event=). Clubs are small, so the
 * page loads all beers and sorts/filters in memory (domain/beers/catalog).
 *
 * Lives in the (catalog) group, so its loading.tsx does not wrap beers/new or
 * beers/[beerId] (TG-008).
 */
export default async function BeersPage({ params, searchParams }: PageProps<"/c/[clubId]/beers">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);

  const [beers, events] = await Promise.all([
    listClubBeers(club.id, user.id),
    listEventOptions(club.id),
  ]);
  const parsed = parseBeerCatalogParams(await searchParams);
  const view = { ...parsed, event: resolveEventFilter(parsed.event, events) };
  const shown = sortBeers(filterBeers(beers, { query: view.q, event: view.event }), view.sort);

  const catalogHref = beersHref(club.id);
  const filteredEvent =
    view.event !== EVENT_FILTER_ALL && view.event !== EVENT_FILTER_NONE ? view.event : null;
  // While one event is shown, "Tilføj øl" adds to that event.
  const addHref = newBeerHref(club.id, { eventId: filteredEvent });
  const isEmpty = beers.length === 0;

  return (
    <>
      <TopBarAction>
        <Button asChild size="icon" variant="brass">
          <Link href={addHref} aria-label="Tilføj øl">
            <PlusIcon aria-hidden />
          </Link>
        </Button>
      </TopBarAction>

      <PageHeader
        title="Ølkatalog"
        action={
          isEmpty ? undefined : (
            <Button asChild className="hidden md:inline-flex">
              <Link href={addHref}>
                <PlusIcon aria-hidden />
                Tilføj øl
              </Link>
            </Button>
          )
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<BeerIcon />}
          title="Kataloget er tomt. Hvad drak I sidst? 🍺"
          description="Tilføj de øl, I smager, så kan alle give dem stjerner."
          actions={
            <Button asChild size="lg">
              <Link href={addHref}>
                <PlusIcon aria-hidden />
                Tilføj øl
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="group/catalog grid gap-4">
          <CatalogControls
            action={catalogHref}
            params={view}
            events={toEventChoices(eventFilterOptions(events, beers, view.event))}
          />

          <div className="grid grid-cols-1 gap-3 transition-opacity group-has-data-pending/catalog:opacity-60">
            <p role="status" className="text-[0.95rem] text-muted-foreground">
              {catalogResultLabel(shown.length, beers.length)}
            </p>
            {shown.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3">
                {shown.map((beer) => (
                  <li key={beer.id}>
                    <BeerCard beer={beer} href={beerHref(club.id, beer.id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <NoMatches
                query={view.q}
                resetHref={`${catalogHref}${beerCatalogSearch({ sort: view.sort })}`}
                addAsNewHref={newBeerHref(club.id, { eventId: filteredEvent, name: view.q })}
                filtered={isFilteredCatalog(view)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** No beer matches the search or filter: say so, offer a reset and (for a search) adding it. */
function NoMatches({
  query,
  resetHref,
  addAsNewHref,
  filtered,
}: {
  query: string;
  resetHref: string;
  /** "Tilføj som ny øl" with the searched name filled in. */
  addAsNewHref: string;
  filtered: boolean;
}) {
  return (
    <EmptyState
      icon={<SearchXIcon />}
      title={
        query ? (
          <>
            Ingen øl matcher „<span className="wrap-anywhere">{query}</span>“
          </>
        ) : (
          "Ingen øl matcher filteret"
        )
      }
      description={
        query
          ? "Måske har I ikke smagt den endnu – eller den hedder noget andet."
          : "Prøv et andet event, eller vis alle øl."
      }
      className="py-8 md:py-10"
      actions={
        <>
          {query ? (
            <Button asChild>
              <Link href={addAsNewHref}>
                <PlusIcon aria-hidden />
                Tilføj som ny øl
              </Link>
            </Button>
          ) : null}
          {filtered ? (
            <Button asChild variant="outline">
              <Link href={resetHref}>Nulstil filtre</Link>
            </Button>
          ) : null}
        </>
      }
    />
  );
}
