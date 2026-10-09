/**
 * Links inside a club (SPEC §8.2) for events and beers, shared by pages,
 * components and Server Actions, so a route is spelled in one place. The
 * calendar's own URL state (?view, ?month, ?day) lives in
 * src/components/features/calendar/calendar-params.ts.
 *
 * Ids are the club's UUIDs; prefill values are URL-encoded. Pure and
 * client-safe.
 */

/** Overblik. */
export function overviewHref(clubId: string): string {
  return `/c/${clubId}`;
}

/**
 * "Opret event". `date` ("YYYY-MM-DD", Copenhagen) pre-fills the date field,
 * e.g. from a day in the calendar.
 */
export function newEventHref(clubId: string, date?: string | null): string {
  const base = `/c/${clubId}/events/new`;
  return date ? `${base}?date=${encodeURIComponent(date)}` : base;
}

export function eventHref(clubId: string, eventId: string): string {
  return `/c/${clubId}/events/${eventId}`;
}

export function editEventHref(clubId: string, eventId: string): string {
  return `${eventHref(clubId, eventId)}/edit`;
}

/** Ølkataloget (without search, sort or filter). */
export function beersHref(clubId: string): string {
  return `/c/${clubId}/beers`;
}

export function beerHref(clubId: string, beerId: string): string {
  return `${beersHref(clubId)}/${beerId}`;
}

export function editBeerHref(clubId: string, beerId: string): string {
  return `${beerHref(clubId, beerId)}/edit`;
}

export type NewBeerPrefill = {
  /** Pre-selects one of the club's events (SPEC §9.2 "+ Tilføj øl", §10.5). */
  eventId?: string | null;
  /** Pre-fills the name (the catalogue's "Tilføj som ny øl" after a search). */
  name?: string | null;
};

/** "Tilføj øl", optionally with the event and/or the name filled in. */
export function newBeerHref(clubId: string, prefill: NewBeerPrefill = {}): string {
  const query = new URLSearchParams();
  if (prefill.eventId) query.set("eventId", prefill.eventId);
  if (prefill.name) query.set("name", prefill.name);
  const search = query.toString();
  return `${beersHref(clubId)}/new${search ? `?${search}` : ""}`;
}

export function songsHref(clubId: string): string {
  return `/c/${clubId}/songs`;
}

/**
 * "Åbn i kort" (SPEC §9.2): a Google Maps search for the free-text place
 * (D-022). Google's documented cross-platform URL; it opens the Maps app on
 * phones that have it. Null for an empty text.
 */
export function mapsSearchUrl(place: string): string | null {
  const query = place.replace(/\s+/g, " ").trim();
  if (query === "") return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
