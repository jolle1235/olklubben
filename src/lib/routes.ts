import { feedbackListSearch, type FeedbackListParams } from "@/server/domain/feedback/list-params";
import { toFeedbackPagePath } from "@/server/domain/feedback/page-path";
import type { FeedbackType } from "@/server/domain/feedback/status";

/**
 * Links inside a club (SPEC §8.2) for events, polls, beers, places, the club
 * page and the profile, plus the app-wide feedback pages (§9.9), shared by
 * pages, components and Server Actions, so a route is spelled in one place
 * (D-076). The calendar's own URL state (?view, ?month, ?day, ?past) lives in
 * src/components/features/calendar/calendar-params.ts.
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

/**
 * A beer's photo (D-158), or null without one (`version` null). `version`
 * (the photo's updatedAt in ms) changes the URL when the photo changes, so
 * the browser may cache each URL forever. `thumb`: the list cards' small copy.
 */
export function beerImageHref(
  clubId: string,
  beerId: string,
  version: number | null,
  { thumb = false }: { thumb?: boolean } = {},
): string | null {
  if (version === null) return null;
  return `${beerHref(clubId, beerId)}/image?v=${version}${thumb ? "&size=thumb" : ""}`;
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

/** "Importér fra PDF" (admins). */
export function importSongsHref(clubId: string): string {
  return `${songsHref(clubId)}/import`;
}

/** One song in the reader. */
export function songHref(clubId: string, songId: string): string {
  return `${songsHref(clubId)}/${songId}`;
}

/** "Rediger sang" (admins). */
export function editSongHref(clubId: string, songId: string): string {
  return `${songHref(clubId, songId)}/edit`;
}

/** "Planlæg ølsmagning" (SPEC §9.7.1). There is no /polls index page (D-138). */
export function newPollHref(clubId: string): string {
  return `/c/${clubId}/polls/new`;
}

/** One poll: voting, results and the outcome. */
export function pollHref(clubId: string, pollId: string): string {
  return `/c/${clubId}/polls/${pollId}`;
}

/** "Rediger" (creator or admin, while OPEN, D-133; dates and places until the first vote, D-153). */
export function editPollHref(clubId: string, pollId: string): string {
  return `${pollHref(clubId, pollId)}/edit`;
}

/** "Stem nu": straight to the vote form (id="stem") on the poll page. */
export function pollVoteHref(clubId: string, pollId: string): string {
  return `${pollHref(clubId, pollId)}#stem`;
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

// ── Feedback (SPEC §9.9): app-wide, outside /c/[clubId] ──────────────────────

/** "Feedback (fejl og ønsker)": the list, with its filters (defaults left out). */
export function feedbackListHref(params: Partial<FeedbackListParams> = {}): string {
  return `/feedback${feedbackListSearch(params)}`;
}

export type NewFeedbackPrefill = {
  /** Pre-selects "Fejl" or "Idé / ønske". */
  type?: FeedbackType | null;
  /**
   * The page the user came from ("Rapportér denne fejl"). Normalised by
   * toFeedbackPagePath, so the club id, query and hash never reach the URL
   * (E26, D-143); dropped when it is not a path.
   */
  page?: string | null;
};

/** "Ny rapport", e.g. /feedback/new?type=bug&page=%2Fcalendar. */
export function newFeedbackHref(prefill: NewFeedbackPrefill = {}): string {
  const query = new URLSearchParams();
  if (prefill.type) query.set("type", prefill.type.toLowerCase());
  const page = toFeedbackPagePath(prefill.page);
  if (page) query.set("page", page);
  const search = query.toString();
  return `/feedback/new${search ? `?${search}` : ""}`;
}

/** One report: description, 👍, status and (app-admins) moderation. */
export function feedbackHref(feedbackId: string): string {
  return `/feedback/${feedbackId}`;
}

/** "Rediger" (the author while NEW, or an app-admin). */
export function editFeedbackHref(feedbackId: string): string {
  return `${feedbackHref(feedbackId)}/edit`;
}
