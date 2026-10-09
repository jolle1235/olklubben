/**
 * Beer ratings (SPEC §9.5, D-003).
 *
 * A rating is stored as an integer in half points, 2..10, so 2 = 1 star and
 * 10 = 5 stars. The UI shows `value / 2` stars. Names in this module:
 *
 *   * "value" / RatingValue: the stored integer 2..10 (a member's own rating).
 *   * "stars": value / 2, 1..5 in half steps; an average in stars may have
 *     any number of decimals (4.25).
 *
 * The club's rating is the average of all ratings, computed on read and never
 * stored (§3.4). Ratings of former members still count (Q6). It is shown with
 * one decimal ("4,3"); one member's rating without a needless ",0" ("5", "4,5").
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const RATING_MIN = 2;
export const RATING_MAX = 10;
export const MAX_STARS = 5;

/** 2, 3, … 10: the nine choices of the rating radio group (§9.5). */
export const RATING_VALUES: readonly number[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, index) => RATING_MIN + index,
);

/** An integer 2..10. */
export function isValidRatingValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX
  );
}

/** 9 → 4.5 */
export function ratingToStars(value: number): number {
  return value / 2;
}

/** 4.5 → 9. Null unless it is a whole or half star from 1 to 5. */
export function starsToRating(stars: number): number | null {
  const value = stars * 2;
  return isValidRatingValue(value) ? value : null;
}

/**
 * The average in stars (not rounded) from the sum and count of stored values,
 * or null when there are no ratings: (17, 2) → 4.25. The data layer gets both
 * from one GROUP BY (D-073, src/server/beers/rating-stats.ts).
 */
export function averageFromSum(sum: number, count: number): number | null {
  return count > 0 ? sum / count / 2 : null;
}

/**
 * The average in stars (not rounded), or null when there are no ratings.
 * [9, 8] → 4.25. Values must be stored ratings (2..10).
 */
export function averageRating(values: readonly number[]): number | null {
  const sum = values.reduce((total, value) => total + value, 0);
  return values.length === 0 ? null : averageFromSum(sum, values.length);
}

/**
 * Rounds to one decimal, half up, without float surprises: 4.35 → 4.4 (plain
 * toFixed(1) gives "4.3", because 4.35 is stored as 4.3499…).
 */
export function roundToTenth(value: number): number {
  return Math.round(Number((value * 10).toPrecision(12))) / 10;
}

const oneDecimal = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});

const upToOneDecimal = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  useGrouping: false,
});

/** An average in stars with one decimal and a comma: 4.25 → "4,3", 4 → "4,0". */
export function formatRating(stars: number): string {
  if (!Number.isFinite(stars)) return "";
  return oneDecimal.format(roundToTenth(stars));
}

/** One member's rating (stored value) in stars: 9 → "4,5", 10 → "5". */
export function formatStars(value: number): string {
  if (!Number.isFinite(value)) return "";
  return upToOneDecimal.format(ratingToStars(value));
}

/** Screen reader text for one rating (stored value): 9 → "4,5 ud af 5". */
export function ratingAriaLabel(value: number): string {
  return `${formatStars(value)} ud af ${MAX_STARS}`;
}

/** Screen reader text for an average in stars: 4.25 → "4,3 ud af 5". */
export function averageRatingAriaLabel(stars: number): string {
  return `${formatRating(stars)} ud af ${MAX_STARS}`;
}

/** "Ingen ratings endnu", "1 rating", "12 ratings" (§9.5 "4,7 · 12 ratings"). */
export function ratingCountLabel(count: number): string {
  if (count <= 0) return "Ingen ratings endnu";
  return count === 1 ? "1 rating" : `${count} ratings`;
}

export type StarFill = "full" | "half" | "empty";

/**
 * Five stars for a value in stars, rounded to the nearest half star:
 * 4.3 → ★★★★½ (["full","full","full","full","half"]), null → all empty.
 */
export function starFills(stars: number | null): StarFill[] {
  const halves = stars == null || !Number.isFinite(stars) ? 0 : Math.round(stars * 2);
  const clamped = Math.min(Math.max(halves, 0), MAX_STARS * 2);
  return Array.from({ length: MAX_STARS }, (_, index) => {
    const remaining = clamped - index * 2;
    if (remaining >= 2) return "full";
    return remaining === 1 ? "half" : "empty";
  });
}
