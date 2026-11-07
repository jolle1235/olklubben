/**
 * What an event shows before its place or time is decided (D-175).
 *
 * Pure module: client-safe.
 */

export const PLACE_UNDECIDED_LABEL = "Sted følger";
export const TIME_UNDECIDED_LABEL = "Tid følger";

/** The place's name, or "Sted følger". */
export function placeNameOrUndecided(place: { name: string } | null): string {
  return place?.name ?? PLACE_UNDECIDED_LABEL;
}
