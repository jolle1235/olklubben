import Link from "next/link";
import { StarIcon } from "lucide-react";

import { formatAbv } from "@/server/domain/beers/abv";
import {
  averageRatingAriaLabel,
  formatRating,
  formatStars,
  ratingAriaLabel,
  ratingCountLabel,
} from "@/server/domain/ratings/ratings";

/** What a card shows of a beer (BeerListItem and EventBeer fit). */
export type BeerCardBeer = {
  name: string;
  abv: number;
  /** The club's average in stars (1–5), null without ratings. */
  averageStars: number | null;
  ratingCount: number;
  /** The member's own rating (stored 2..10), null when not rated yet. */
  myRating: number | null;
  /** Shown after the ABV ("6,5 % · Ølsmagning #12"). Leave it out where the event is obvious. */
  event?: { title: string } | null;
};

export type BeerCardProps = {
  beer: BeerCardBeer;
  href: string;
};

/**
 * One beer in the catalogue (SPEC §9.5 "Oversigt"):
 *
 *   🍺 Grimbergen Dubbel        ★ 4,7 (12)
 *      6,5 % · Ølsmagning #12          Din: ★ 5
 *
 * "Din: –" shows what the member has not rated yet. The whole card is one
 * link; screen readers get full sentences instead of the symbols. Used by the
 * catalogue and the event page's "Øl smagt til dette event" (§9.2), so the
 * club's and your own rating look the same everywhere.
 */
export function BeerCard({ beer, href }: BeerCardProps) {
  return (
    <Link
      href={href}
      className="group/beer flex gap-3 rounded-xl border border-border bg-paper px-4 py-3.5 transition-[border-color,box-shadow] hover:border-input hover:shadow-[0_10px_24px_-20px_rgb(65_68_55/0.7)] sm:gap-4 sm:px-5"
    >
      <span
        aria-hidden
        className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-cream-deep text-xl"
      >
        🍺
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 font-heading text-lg leading-snug font-semibold break-words hyphens-auto text-olive group-hover/beer:underline group-hover/beer:decoration-amber group-hover/beer:decoration-2 group-hover/beer:underline-offset-4">
            {beer.name}
          </span>
          <ClubScore averageStars={beer.averageStars} ratingCount={beer.ratingCount} />
        </span>
        <span className="flex items-start justify-between gap-3 text-[0.95rem] text-muted-foreground">
          <span className="min-w-0 break-words hyphens-auto">
            {formatAbv(beer.abv)}
            {beer.event ? <> · {beer.event.title}</> : null}
          </span>
          <MyScore value={beer.myRating} />
        </span>
      </span>
    </Link>
  );
}

function ClubScore({
  averageStars,
  ratingCount,
}: Pick<BeerCardBeer, "averageStars" | "ratingCount">) {
  if (averageStars === null) {
    return (
      <span className="shrink-0 pt-0.5 text-[0.95rem] text-muted-foreground">Ingen ratings</span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 pt-0.5 font-semibold text-ink tabular-nums">
      <span aria-hidden className="flex items-center gap-1">
        <StarIcon className="size-[1.05em] fill-current text-amber-ink" strokeWidth={1.75} />
        {formatRating(averageStars)}
        <span className="font-normal text-muted-foreground">({ratingCount})</span>
      </span>
      <span className="sr-only">
        , klubbens rating {averageRatingAriaLabel(averageStars)} ({ratingCountLabel(ratingCount)})
      </span>
    </span>
  );
}

function MyScore({ value }: { value: number | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1 tabular-nums">
      <span aria-hidden className="flex items-center gap-1">
        Din:
        {value === null ? (
          <span className="font-semibold">–</span>
        ) : (
          <>
            <StarIcon className="size-[1em] fill-current text-amber-ink" strokeWidth={1.75} />
            <span className="font-semibold text-ink">{formatStars(value)}</span>
          </>
        )}
      </span>
      <span className="sr-only">
        , {value === null ? "du har ikke ratet den endnu" : `din rating ${ratingAriaLabel(value)}`}
      </span>
    </span>
  );
}
