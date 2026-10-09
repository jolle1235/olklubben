import {
  EVENT_FILTER_ALL,
  EVENT_FILTER_NONE,
  type BeerEventFilter,
} from "@/server/domain/beers/catalog";
import { formatCompactDate } from "@/lib/format/date";

/**
 * View helpers for the beer catalogue and the beer form (SPEC §9.5) that the
 * shared domain module (src/server/domain/beers/catalog.ts) does not cover.
 *
 * Pure and client-safe.
 */

type EventRef = { id: string };

/**
 * The event filter as the page should use it: "all", "none" or the id of one
 * of the club's events. An id that is not one of them (a deleted event, a
 * hand-edited URL) falls back to "all", so the select never shows "Alle
 * events" while an invisible filter hides every beer.
 */
export function resolveEventFilter(
  filter: BeerEventFilter,
  events: readonly EventRef[],
): BeerEventFilter {
  if (filter === EVENT_FILTER_ALL || filter === EVENT_FILTER_NONE) return filter;
  return events.some((event) => event.id === filter) ? filter : EVENT_FILTER_ALL;
}

/**
 * The events worth offering in the filter: those with at least one beer, plus
 * the active one. Keeps the input order (the data layer gives newest first).
 */
export function eventFilterOptions<T extends EventRef>(
  events: readonly T[],
  beers: readonly { eventId: string | null }[],
  active: BeerEventFilter,
): T[] {
  const withBeers = new Set(beers.map((beer) => beer.eventId));
  return events.filter((event) => withBeers.has(event.id) || event.id === active);
}

/** An event as a choice in a select: "Ølsmagning #12 · 14. sep 2026" (Copenhagen date). */
export function toEventChoices(
  events: readonly { id: string; title: string; startsAt: Date }[],
): { id: string; label: string }[] {
  return events.map((event) => ({
    id: event.id,
    label: `${event.title} · ${formatCompactDate(event.startsAt)}`,
  }));
}

/** "1 øl", "6 øl" (the same word in singular and plural). */
export function beerCountLabel(count: number): string {
  return `${count} øl`;
}

/** The status line above the list: "6 øl" or "Viser 2 af 6 øl" when filtered. */
export function catalogResultLabel(shown: number, total: number): string {
  return shown === total ? beerCountLabel(total) : `Viser ${shown} af ${beerCountLabel(total)}`;
}

/**
 * What the duplicate check needs from a beer (findSameNameBeers in
 * src/server/domain/beers/name.ts, also used by the Server Actions).
 */
export type BeerNameEntry = { id: string; name: string; abv: number };

/** Merges two lists of beers by id, first list first. */
export function mergeBeersById<T extends { id: string }>(
  first: readonly T[],
  second: readonly T[],
) {
  const seen = new Set(first.map((beer) => beer.id));
  return [...first, ...second.filter((beer) => !seen.has(beer.id))];
}

/**
 * The delete confirmation (E14): the ratings go with the beer, so say how
 * many. 0 → "Øllen bliver slettet. …", 3 → "Øllen og dens 3 ratings …".
 */
export function deleteBeerDescription(ratingCount: number): string {
  const ratings =
    ratingCount <= 0 ? null : ratingCount === 1 ? "dens ene rating" : `dens ${ratingCount} ratings`;
  return `${ratings ? `Øllen og ${ratings}` : "Øllen"} bliver slettet. Det kan ikke fortrydes.`;
}
