import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { averageFromSum } from "@/server/domain/ratings/ratings";

/**
 * Rating aggregates per beer, computed in SQL on read (SPEC §3.4: the club's
 * rating is never stored). Shared by src/server/beers/queries.ts and
 * src/server/events/queries.ts.
 *
 * The callers pass a `where` that is already scoped to one club, e.g.
 * { beer: { clubId } } (§4.4).
 */

export type RatingStats = {
  /** Average in stars (1–5, not rounded), null without ratings. Format with formatRating(). */
  averageStars: number | null;
  ratingCount: number;
  /** The given user's own rating (stored value 2..10), null if none. */
  myRating: number | null;
};

export const NO_RATINGS: RatingStats = { averageStars: null, ratingCount: 0, myRating: null };

/**
 * Sum and count per beer (one GROUP BY, D-073), plus the user's own ratings.
 * The average in stars comes from averageFromSum(); formatRating() rounds it
 * without float surprises (both in src/server/domain/ratings/ratings.ts).
 */
export async function getRatingStats(
  where: Prisma.BeerRatingWhereInput,
  userId: string | null,
): Promise<Map<string, RatingStats>> {
  const [groups, mine] = await Promise.all([
    db.beerRating.groupBy({
      by: ["beerId"],
      where,
      _sum: { value: true },
      _count: { _all: true },
    }),
    userId
      ? db.beerRating.findMany({
          where: { AND: [where, { userId }] },
          select: { beerId: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  const myRatings = new Map(mine.map((rating) => [rating.beerId, rating.value]));
  const stats = new Map<string, RatingStats>();
  for (const group of groups) {
    const count = group._count._all;
    const sum = group._sum.value ?? 0;
    stats.set(group.beerId, {
      averageStars: averageFromSum(sum, count),
      ratingCount: count,
      myRating: myRatings.get(group.beerId) ?? null,
    });
  }
  return stats;
}
