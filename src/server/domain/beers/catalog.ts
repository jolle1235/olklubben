import { isValidId } from "@/lib/ids";
import { firstParam, type SearchParamValue } from "@/lib/search-params";

import { normalizeBeerName } from "./name";

/**
 * The beer catalogue's search, sort and filter (SPEC §9.5 "Oversigt").
 *
 * Clubs are small (§1.1), so the data layer returns every beer of the club
 * with its rating aggregates (listClubBeers) and the page sorts and filters
 * in memory with these functions. The URL carries the choices
 * (?q=…&sort=…&event=…); they are untrusted and parsed with safe defaults.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const BEER_SORTS = [
  "rating",
  "most-rated",
  "newest",
  "abv-desc",
  "abv-asc",
  "name",
] as const;
export type BeerSort = (typeof BEER_SORTS)[number];
export const DEFAULT_BEER_SORT: BeerSort = "rating";

export const BEER_SORT_LABELS: Record<BeerSort, string> = {
  rating: "Bedste rating",
  "most-rated": "Flest ratings",
  newest: "Nyeste",
  "abv-desc": "Alkohol (høj–lav)",
  "abv-asc": "Alkohol (lav–høj)",
  name: "Navn (A–Å)",
};

/** Event filter: every beer, beers without an event, or one event's id. */
export const EVENT_FILTER_ALL = "all";
export const EVENT_FILTER_NONE = "none";
export type BeerEventFilter = string;

export const MAX_SEARCH_LENGTH = 100;

/** What sorting and filtering need from a beer (BeerListItem has all of it). */
export type CatalogBeer = {
  id: string;
  name: string;
  abv: number;
  createdAt: Date;
  eventId: string | null;
  /** Average in stars, null without ratings. */
  averageStars: number | null;
  ratingCount: number;
};

/**
 * Danish alphabetical order: Æ, Ø, Å after Z, and numbers by value ("IPA 2"
 * before "IPA 10"). Note: Danish collation reads "aa" as "å", so "Aass Bock"
 * sorts with Å at the end, as in a Danish dictionary.
 */
const nameCollator = new Intl.Collator("da", { numeric: true });

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A–Å, then id (stable for equal names). */
export function compareBeerNames(
  a: Pick<CatalogBeer, "id" | "name">,
  b: Pick<CatalogBeer, "id" | "name">,
): number {
  return nameCollator.compare(a.name, b.name) || compareIds(a.id, b.id);
}

/** Descending, with null (no ratings) last. */
function compareAverageDesc(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === null ? (b === null ? 0 : 1) : -1;
  return b - a;
}

const COMPARATORS: Record<BeerSort, (a: CatalogBeer, b: CatalogBeer) => number> = {
  // Unrated last; then higher average, more ratings, name.
  rating: (a, b) =>
    compareAverageDesc(a.averageStars, b.averageStars) ||
    b.ratingCount - a.ratingCount ||
    compareBeerNames(a, b),
  // More ratings first (unrated have 0 and come last); then higher average, name.
  "most-rated": (a, b) =>
    b.ratingCount - a.ratingCount ||
    compareAverageDesc(a.averageStars, b.averageStars) ||
    compareBeerNames(a, b),
  // Newest first; UUIDv7 ids sort by creation time too.
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || compareIds(b.id, a.id),
  "abv-desc": (a, b) => b.abv - a.abv || compareBeerNames(a, b),
  "abv-asc": (a, b) => a.abv - b.abv || compareBeerNames(a, b),
  name: compareBeerNames,
};

/** A sorted copy (the input is not changed). Every sort has a full tie-breaker. */
export function sortBeers<T extends CatalogBeer>(beers: readonly T[], sort: BeerSort): T[] {
  return [...beers].sort(COMPARATORS[sort]);
}

/** True when the name contains the search text (case-insensitive, æ/ø/å-aware). */
export function matchesBeerSearch(name: string, query: string): boolean {
  const needle = normalizeBeerName(query);
  return needle === "" || normalizeBeerName(name).includes(needle);
}

export type BeerFilter = {
  /** Search text; "" = no search. */
  query?: string;
  /** EVENT_FILTER_ALL (default), EVENT_FILTER_NONE or an event id. */
  event?: BeerEventFilter;
};

/** True when the beer passes the event filter. */
export function matchesEventFilter(
  beer: Pick<CatalogBeer, "eventId">,
  event: BeerEventFilter,
): boolean {
  if (event === EVENT_FILTER_ALL) return true;
  if (event === EVENT_FILTER_NONE) return beer.eventId === null;
  return beer.eventId === event;
}

/** The beers that match the search and the event filter, in input order. */
export function filterBeers<T extends CatalogBeer>(beers: readonly T[], filter: BeerFilter): T[] {
  const query = filter.query ?? "";
  const event = filter.event ?? EVENT_FILTER_ALL;
  return beers.filter(
    (beer) => matchesEventFilter(beer, event) && matchesBeerSearch(beer.name, query),
  );
}

export type BeerCatalogParams = { q: string; sort: BeerSort; event: BeerEventFilter };

export const DEFAULT_BEER_CATALOG_PARAMS: BeerCatalogParams = {
  q: "",
  sort: DEFAULT_BEER_SORT,
  event: EVENT_FILTER_ALL,
};

export function isBeerSort(value: unknown): value is BeerSort {
  return typeof value === "string" && (BEER_SORTS as readonly string[]).includes(value);
}

/**
 * The catalogue's choices from untrusted searchParams (?q=, ?sort=, ?event=).
 * Unknown sorts and malformed event ids fall back to the defaults; the search
 * text is trimmed and cut at 100 characters. Never throws. Whether an event id
 * belongs to the club does not matter: an unknown id simply matches nothing.
 */
export function parseBeerCatalogParams(
  searchParams: Record<string, SearchParamValue>,
): BeerCatalogParams {
  const q = (firstParam(searchParams.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const sortParam = firstParam(searchParams.sort);
  const eventParam = firstParam(searchParams.event);
  const event =
    eventParam === EVENT_FILTER_NONE || isValidId(eventParam) ? eventParam : EVENT_FILTER_ALL;
  return { q, sort: isBeerSort(sortParam) ? sortParam : DEFAULT_BEER_SORT, event };
}

/** The query string for the choices, without defaults: "?q=ipa&sort=name" or "". */
export function beerCatalogSearch(params: Partial<BeerCatalogParams>): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.sort && params.sort !== DEFAULT_BEER_SORT) search.set("sort", params.sort);
  if (params.event && params.event !== EVENT_FILTER_ALL) search.set("event", params.event);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** True when a search or event filter is active (for "no matches" vs. the empty catalogue). */
export function isFilteredCatalog(params: Pick<BeerCatalogParams, "q" | "event">): boolean {
  return params.q !== "" || params.event !== EVENT_FILTER_ALL;
}
