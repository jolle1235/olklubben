import { cleanSingleLine, nameKey } from "@/lib/text";

/**
 * Beer names (SPEC §9.5): 1–120 characters.
 *
 *   * cleanBeerName: how a name is stored – U+0000 removed, trimmed, inner
 *     whitespace collapsed to one space, Unicode NFC (so "ø" typed two ways is
 *     the same). = cleanSingleLine (src/lib/text.ts).
 *   * normalizeBeerName: the SEARCH key – cleaned and lower-cased the Danish
 *     way ("Ø" → "ø"). Keeps the word boundaries, so "geek break" finds
 *     "Beer Geek Breakfast".
 *   * beerDuplicateKey: the DUPLICATE key for the warning "Den her har I vist
 *     smagt før 👀" (E21) – ignores case and all whitespace, so "Grimbergen
 *     Dubbel" ≡ "GrimbergenDubbel". findSameNameBeers applies it to a list
 *     (the form while typing, the Server Actions on submit). = nameKey, the
 *     same rule as place names (D-086, D-095).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const BEER_NAME_MAX_LENGTH = 120;

/** Trimmed, single spaces, NFC, no NUL: "  Westmalle   Tripel " → "Westmalle Tripel". */
export function cleanBeerName(name: string): string {
  return cleanSingleLine(name);
}

/** Search key: "  WESTMALLE  tripel" and "Westmalle Tripel" → "westmalle tripel". */
export function normalizeBeerName(name: string): string {
  return cleanBeerName(name).toLocaleLowerCase("da");
}

/** Duplicate key (E21): "Grimbergen Dubbel" and "GRIMBERGENDUBBEL" → "grimbergendubbel". */
export function beerDuplicateKey(name: string): string {
  return nameKey(name);
}

/** True when two names count as the same beer (E21). */
export function isSameBeerName(a: string, b: string): boolean {
  return beerDuplicateKey(a) === beerDuplicateKey(b);
}

/**
 * The beers with the same name as `name` (E21), in the given order.
 * `excludeId` leaves out the beer being edited. An empty name matches nothing.
 */
export function findSameNameBeers<T extends { id: string; name: string }>(
  beers: readonly T[],
  name: string,
  excludeId?: string,
): T[] {
  const key = beerDuplicateKey(name);
  if (key === "") return [];
  return beers.filter((beer) => beer.id !== excludeId && beerDuplicateKey(beer.name) === key);
}
