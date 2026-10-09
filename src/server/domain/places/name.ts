import { cleanSingleLine, nameKey } from "@/lib/text";

/**
 * Place names (SPEC §9.4, D-095): 1–120 characters, one ACTIVE place per name
 * key and club (partial unique index places_club_id_name_key_active_key).
 *
 *   * cleanPlaceName: how a name is stored (NUL removed, NFC, whitespace
 *     collapsed, trimmed).
 *   * placeNameKey: what makes two names the same place ("Hos Mads" ≡
 *     " hos  MADS "): the shared nameKey rule (src/lib/text.ts). Stored in
 *     places.name_key; the round-3 migration computes the same key in SQL.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** 120, not §11's 80: round 2's free-text places (1–120) migrate without loss (D-095). */
export const PLACE_NAME_MAX_LENGTH = 120;
export const PLACE_ADDRESS_MAX_LENGTH = 200;
export const PLACE_DESCRIPTION_MAX_LENGTH = 1000;

/** "  Hos   Mads " → "Hos Mads". */
export function cleanPlaceName(name: string): string {
  return cleanSingleLine(name);
}

/** "Hos Mads", " HOS  mads" → "hosmads". "" for an empty name. */
export function placeNameKey(name: string): string {
  return nameKey(name);
}

/** True when both are names (not empty) of the same place. */
export function isSamePlaceName(a: string, b: string): boolean {
  const key = placeNameKey(a);
  return key !== "" && key === placeNameKey(b);
}

/**
 * The first place with the same name as `name`, or null. `excludeId` leaves out
 * the place being edited. An empty name matches nothing. Used by the event
 * form's live hint ("«Hos Mads» findes allerede.") and the place form.
 */
export function findSamePlace<T extends { id: string; name: string }>(
  places: readonly T[],
  name: string,
  excludeId?: string,
): T | null {
  const key = placeNameKey(name);
  if (key === "") return null;
  return places.find((place) => place.id !== excludeId && placeNameKey(place.name) === key) ?? null;
}

// Danish alphabet: Æ, Ø and Å come after Z. Case and accents only break ties.
const collator = new Intl.Collator("da", { sensitivity: "base" });
const tieBreaker = new Intl.Collator("da");

/** By name in Danish order, then exact spelling, then id, so the order never flickers. */
export function comparePlacesByName(
  a: { id: string; name: string },
  b: { id: string; name: string },
): number {
  return (
    collator.compare(a.name, b.name) ||
    tieBreaker.compare(a.name, b.name) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
