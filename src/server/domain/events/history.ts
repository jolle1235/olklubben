import { formatRating } from "@/server/domain/ratings/ratings";

/**
 * Event history (SPEC §9.3, D-107): "Tidligere ølsmagninger" on Overblik (the
 * newest few) and in the calendar's list view (#tidligere).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** Past tastings on Overblik. */
export const OVERVIEW_HISTORY_LIMIT = 3;
/** Past tastings in the calendar list before "Vis alle N tidligere" (?past=all). */
export const CALENDAR_HISTORY_LIMIT = 12;

const nameCollator = new Intl.Collator("da");

/**
 * The best-rated beer: highest average, then more ratings, then name (Danish
 * order). Unrated beers never win. Null when no beer has a rating.
 */
export function topRatedBeer<
  T extends { name: string; averageStars: number | null; ratingCount: number },
>(beers: readonly T[]): T | null {
  let best: T | null = null;
  for (const beer of beers) {
    if (beer.averageStars === null || beer.ratingCount === 0) continue;
    if (
      best === null ||
      beer.averageStars > (best.averageStars ?? 0) ||
      (beer.averageStars === best.averageStars &&
        (beer.ratingCount > best.ratingCount ||
          (beer.ratingCount === best.ratingCount &&
            nameCollator.compare(beer.name, best.name) < 0)))
    ) {
      best = beer;
    }
  }
  return best;
}

/**
 * The meta line under a past tasting: "4 øl · Bedst: Westmalle Tripel ★ 4,7",
 * "1 øl" (no ratings yet) or "Ingen øl registreret".
 */
export function pastEventMetaLabel(input: {
  beerCount: number;
  topBeer: { name: string; averageStars: number } | null;
}): string {
  if (input.beerCount <= 0) return "Ingen øl registreret";
  const count = `${input.beerCount} øl`;
  if (!input.topBeer) return count;
  return `${count} · Bedst: ${input.topBeer.name} ★ ${formatRating(input.topBeer.averageStars)}`;
}

/**
 * pastEventMetaLabel as shown on screen: no-break spaces around the star, so
 * "★ 4,7" never wraps onto a line of its own (it moves with the beer's last
 * word). Agent C, round 3.
 */
export function pastEventMetaDisplay(input: Parameters<typeof pastEventMetaLabel>[0]): string {
  return pastEventMetaLabel(input).replace(" ★ ", " ★ ");
}
