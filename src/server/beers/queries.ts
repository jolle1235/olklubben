import "server-only";

import { cache } from "react";

import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";
import { findSameNameBeers } from "@/server/domain/beers/name";
import { averageRating } from "@/server/domain/ratings/ratings";

import { getRatingStats, NO_RATINGS, type RatingStats } from "./rating-stats";

/**
 * Read queries for the beer catalogue and ratings (SPEC §9.5).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it. The
 * caller must already have checked membership (requireMembership /
 * requireBeer). Clubs are small (§1.1): listClubBeers returns every beer with
 * its aggregates, and the page sorts and filters with
 * src/server/domain/beers/catalog.ts.
 */

export type BeerEventRef = { id: string; title: string; startsAt: Date };

export type BeerListItem = RatingStats & {
  id: string;
  name: string;
  /** 0.0–99.9, one decimal. Format with formatAbv(). */
  abv: number;
  createdAt: Date;
  createdById: string;
  eventId: string | null;
  event: BeerEventRef | null;
};

export type BeerRatingEntry = {
  user: { id: string; name: string };
  /** Stored value 2..10 (formatStars(value) → "4,5"). */
  value: number;
  updatedAt: Date;
};

export type BeerDetail = BeerListItem & {
  updatedAt: Date;
  createdBy: { id: string; name: string };
  /** Every rating, highest first, then by name (Danish order). */
  ratings: BeerRatingEntry[];
};

export type SimilarBeer = { id: string; name: string; abv: number };

const eventRefSelect = { select: { id: true, title: true, startsAt: true } } as const;

const nameCollator = new Intl.Collator("da");

/**
 * Every beer of the club, newest first, with the club's average, the number of
 * ratings and the user's own rating ("Din: ★ 5", §9.5). Aggregates come from
 * one GROUP BY in SQL.
 */
export async function listClubBeers(clubId: string, userId: string): Promise<BeerListItem[]> {
  const [beers, stats] = await Promise.all([
    db.beer.findMany({
      where: { clubId },
      select: {
        id: true,
        name: true,
        abv: true,
        createdAt: true,
        createdById: true,
        eventId: true,
        event: eventRefSelect,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    getRatingStats({ beer: { clubId } }, userId),
  ]);

  return beers.map((beer) => ({
    ...beer,
    abv: beer.abv.toNumber(),
    ...(stats.get(beer.id) ?? NO_RATINGS),
  }));
}

/**
 * One beer of the club with its event, creator and every rating, or null
 * (unknown id, malformed id or another club's beer). Cached per request, so
 * a guard layout and its page share one query.
 */
export const getBeer = cache(
  async (clubId: string, beerId: string, userId: string): Promise<BeerDetail | null> => {
    if (!isValidId(beerId)) return null;
    const beer = await db.beer.findFirst({
      where: { id: beerId, clubId },
      select: {
        id: true,
        name: true,
        abv: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        createdBy: { select: { id: true, name: true } },
        eventId: true,
        event: eventRefSelect,
        ratings: {
          select: { value: true, updatedAt: true, user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!beer) return null;

    const ratings = [...beer.ratings].sort(
      (a, b) =>
        b.value - a.value ||
        nameCollator.compare(a.user.name, b.user.name) ||
        (a.user.id < b.user.id ? -1 : 1),
    );
    return {
      ...beer,
      abv: beer.abv.toNumber(),
      ratings,
      averageStars: averageRating(ratings.map((rating) => rating.value)),
      ratingCount: ratings.length,
      myRating: ratings.find((rating) => rating.user.id === userId)?.value ?? null,
    };
  },
);

/**
 * The club's beer names, oldest first. Feeds the beer form's live duplicate
 * hint ("Den her har I vist smagt før 👀", SPEC §9.5, E21): clubs are small
 * (§1.1), so the form gets the whole list and compares as the member types
 * (findSameNameBeers in src/server/domain/beers/name.ts).
 */
export async function listBeerNames(clubId: string): Promise<SimilarBeer[]> {
  const beers = await db.beer.findMany({
    where: { clubId },
    select: { id: true, name: true, abv: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return beers.map((beer) => ({ ...beer, abv: beer.abv.toNumber() }));
}

/**
 * Beers of the club with the same name, ignoring case and all whitespace (the
 * duplicate warning, §9.5, E21), checked by the Server Actions on submit.
 * Compared in JavaScript with findSameNameBeers (src/server/domain/beers/name.ts,
 * the same rule the form uses while typing), because Postgres' lower() in a
 * C-locale database leaves Æ/Ø/Å alone. `excludeId` leaves out the beer being
 * edited.
 */
export async function findSimilarBeers(
  clubId: string,
  name: string,
  excludeId?: string,
): Promise<SimilarBeer[]> {
  return findSameNameBeers(await listBeerNames(clubId), name, excludeId);
}
