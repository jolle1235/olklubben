import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { BeerCard, type BeerCardBeer } from "@/components/features/beers/beer-card";
import { Button } from "@/components/ui/button";
import { beerImageHref, eventBeerHref } from "@/lib/routes";

export type EventBeerListItem = BeerCardBeer & { id: string; imageVersion: number | null };

export type EventBeerListProps = {
  clubId: string;
  /** The event's beers, best club rating first, unrated last (getEventBeers). */
  beers: readonly EventBeerListItem[];
  /** "+ Tilføj øl" with the event pre-filled. */
  addBeerHref: string;
  /** "Tilføj øl" is the page's primary action (SPEC §13.4.5). */
  emphasizeAdd: boolean;
};

/**
 * "Øl smagt til dette event" (SPEC §9.2): the beers as the catalogue's cards
 * (ABV, the club's rating and "Din: –" for what you have not rated yet,
 * §10.5), best rated first, each linking to the beer page
 * opened "from the event" (back link, "Din rating" first). Then "+ Tilføj øl"
 * with the event pre-filled.
 */
export function EventBeerList({ clubId, beers, addBeerHref, emphasizeAdd }: EventBeerListProps) {
  return (
    <div className="grid grid-cols-1 gap-5">
      {beers.length === 0 ? (
        <p className="text-center text-lead text-balance text-muted-foreground">
          Ingen øl her endnu. Hvad bliver der skænket op? 🍺
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 text-left">
          {beers.map((beer) => (
            <li key={beer.id}>
              <BeerCard
                beer={beer}
                href={eventBeerHref(clubId, beer.id)}
                imageUrl={beerImageHref(clubId, beer.id, beer.imageVersion, { thumb: true })}
              />
            </li>
          ))}
        </ul>
      )}

      <Button
        asChild
        size="lg"
        variant={emphasizeAdd ? "default" : "outline"}
        className="w-full sm:w-auto sm:justify-self-center"
      >
        <Link href={addBeerHref}>
          <PlusIcon aria-hidden />
          Tilføj øl
        </Link>
      </Button>
    </div>
  );
}
