/**
 * Links inside a club (SPEC §8.2) for events, beers, places, the club page
 * and the profile, shared by pages, components and Server Actions, so a route
 * is spelled in one place (D-076). The calendar's own URL state (?view,
 * ?month, ?day, ?past) lives in src/components/features/calendar/calendar-params.ts.
 *
 * Ids are the club's UUIDs; prefill values are URL-encoded. Pure and
 * client-safe.
 */

/** Overblik. */
export function overviewHref(clubId: string): string {
  return `/c/${clubId}`;
}

export type NewEventPrefill = {
  /** "YYYY-MM-DD" (Copenhagen) pre-fills the date, e.g. from a day in the calendar. */
  date?: string | null;
  /** Pre-selects one of the club's active places ("Opret event her" on a place, D-108). */
  placeId?: string | null;
};

/** "Opret event", optionally with the date and/or the place filled in. */
export function newEventHref(clubId: string, prefill: NewEventPrefill = {}): string {
  const query = new URLSearchParams();
  if (prefill.date) query.set("date", prefill.date);
  if (prefill.placeId) query.set("placeId", prefill.placeId);
  const search = query.toString();
  return `/c/${clubId}/events/new${search ? `?${search}` : ""}`;
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

/** Sangbogen (SPEC §9.6), without a search. Song URLs never carry `?q=`. */
export function songsHref(clubId: string): string {
  return `/c/${clubId}/songs`;
}

/** "Tilføj sang" (admins). */
export function newSongHref(clubId: string): string {
  return `${songsHref(clubId)}/new`;
}

/** One song in the reader. */
export function songHref(clubId: string, songId: string): string {
  return `${songsHref(clubId)}/${songId}`;
}

/** "Rediger sang" (admins). */
export function editSongHref(clubId: string, songId: string): string {
  return `${songHref(clubId, songId)}/edit`;
}

/** Steder (SPEC §9.4). */
export function placesHref(clubId: string): string {
  return `/c/${clubId}/places`;
}

export function newPlaceHref(clubId: string): string {
  return `${placesHref(clubId)}/new`;
}

export function placeHref(clubId: string, placeId: string): string {
  return `${placesHref(clubId)}/${placeId}`;
}

export function editPlaceHref(clubId: string, placeId: string): string {
  return `${placeHref(clubId, placeId)}/edit`;
}

/** Klubbens side: members, invitation, places, Farezone (SPEC §9.8). */
export function clubHref(clubId: string): string {
  return `/c/${clubId}/club`;
}

/** "Rediger klubinfo" (admins, D-110). */
export function editClubHref(clubId: string): string {
  return `${clubHref(clubId)}/edit`;
}

/** Profil (D-023: under the club, so the app shell stays). */
export function profileHref(clubId: string): string {
  return `/c/${clubId}/profile`;
}

/**
 * "Åbn i kort" (SPEC §9.2): a Google Maps search. Callers pass the place's
 * address (D-101). Google's documented cross-platform URL; it opens the Maps
 * app on phones that have it. Null for an empty text.
 */
export function mapsSearchUrl(place: string): string | null {
  const query = place.replace(/\s+/g, " ").trim();
  if (query === "") return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
