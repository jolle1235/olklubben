import { MAX_STARS, RATING_MAX, RATING_MIN } from "@/server/domain/ratings/ratings";

/**
 * Input rules for the interactive rating (<BeerRating />, SPEC §9.5, §15.2).
 *
 * Values are the stored half points 2..10 (D-003): 2 = 1 star, 9 = 4½ stars.
 *
 *   * Pointer: the left half of a star gives a half star, the right half a
 *     whole star. The scale starts at 1 star, so both halves of the FIRST star
 *     give 1 star (there is no ½). Five stars → 9 hit areas → 9 values.
 *   * Keyboard (a radio group with slider-like arrows): Left/Down −½,
 *     Right/Up +½, Home = 1 star, End = 5 stars. Clamped, no wrap-around.
 *     From "no rating", any arrow starts at 1 star.
 *
 * Pure and client-safe.
 */

/** The values of a star's hit areas, left to right. Star 0 → [2]; star 3 → [7, 8]. */
export function starHitValues(starIndex: number): readonly number[] {
  if (!Number.isInteger(starIndex) || starIndex < 0 || starIndex >= MAX_STARS) return [];
  if (starIndex === 0) return [RATING_MIN];
  return [starIndex * 2 + 1, starIndex * 2 + 2];
}

const DECREASE_KEYS = new Set(["ArrowLeft", "ArrowDown"]);
const INCREASE_KEYS = new Set(["ArrowRight", "ArrowUp"]);

/**
 * The rating after a key press, or undefined when the key is not a rating key
 * (let the browser handle it, e.g. Tab). Returns the same value at the ends.
 */
export function ratingAfterKey(current: number | null, key: string): number | undefined {
  if (key === "Home") return RATING_MIN;
  if (key === "End") return RATING_MAX;
  const increase = INCREASE_KEYS.has(key);
  if (!increase && !DECREASE_KEYS.has(key)) return undefined;
  if (current === null) return RATING_MIN;
  const next = current + (increase ? 1 : -1);
  return Math.min(Math.max(next, RATING_MIN), RATING_MAX);
}
