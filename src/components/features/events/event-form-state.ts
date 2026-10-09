import { getDisplayName } from "@/lib/format/display-name";
import { formatDanishList } from "@/lib/format/list";
import { EVENT_PLACE_NEW } from "@/lib/validation/event";
import { sameIdSet, suggestHosts, type HostSuggestion } from "@/server/domain/events/hosts";
import { findSamePlace } from "@/server/domain/places/name";

/**
 * The event form's place and host rules (SPEC §9.2, D-098, D-099), as pure
 * functions so the PlaceSelector and the HostsPicker stay small and the rules
 * are unit-tested. The server decides again (resolveHostIds, the place under a
 * row lock); this only drives what the form shows and pre-fills.
 *
 * Pure module: client-safe.
 */

/** A place the selector offers (PlaceOption from src/server/places/queries.ts fits). */
export type PlaceChoice = {
  id: string;
  name: string;
  address: string | null;
  archived: boolean;
  ownerIds: readonly string[];
  /** Display names, same order as ownerIds. */
  ownerNames: readonly string[];
};

/** A chip in the HostsPicker. */
export type HostChoice = {
  id: string;
  /** getDisplayName (nickname wins, D-105). */
  displayName: string;
  image: string | null;
  /** A host who has left the club: shown on edit, may stay, cannot be added again (§7.4). */
  former: boolean;
};

/** A user as the queries return it (PersonRef from src/server/users/select.ts fits). */
type Person = { id: string; name: string; nickname: string | null; image: string | null };

/** The selector's places from listPlaceOptions, without what the client does not need. */
export function toPlaceChoices(places: readonly PlaceChoice[]): PlaceChoice[] {
  return places.map(({ id, name, address, archived, ownerIds, ownerNames }) => ({
    id,
    name,
    address,
    archived,
    ownerIds,
    ownerNames,
  }));
}

/**
 * The picker's chips: the club's members (listMemberOptions, by display
 * name), then hosts of the event who have left the club (edit, §7.4).
 */
export function toHostChoices(
  members: readonly Person[],
  formerHosts: readonly Person[] = [],
): HostChoice[] {
  const memberIds = new Set(members.map((member) => member.id));
  const chip = (person: Person, former: boolean): HostChoice => ({
    id: person.id,
    displayName: getDisplayName(person),
    image: person.image,
    former,
  });
  return [
    ...members.map((member) => chip(member, false)),
    ...formerHosts.filter((host) => !memberIds.has(host.id)).map((host) => chip(host, true)),
  ];
}

/**
 * Who hosts when the place has no owners (the server's fallback order,
 * D-098): creating → the user; editing → the event's creator while a member,
 * else the user editing it.
 */
export function hostFallbackFor(input: {
  user: Pick<Person, "id" | "name" | "nickname">;
  creator?: Pick<Person, "id" | "name" | "nickname"> | null;
  memberIds: ReadonlySet<string>;
}): { userId: string; name: string } {
  const person =
    input.creator && input.memberIds.has(input.creator.id) ? input.creator : input.user;
  return { userId: person.id, name: getDisplayName(person) };
}

/** With more places than this, the rest sit in "Vis alle N steder". */
export const PLACE_SELECTOR_LIMIT = 6;
/** How many cards show before "Vis alle N steder". */
export const PLACE_SELECTOR_SHOWN = 5;

/**
 * Which place starts selected:
 *   1. the echo of a failed submit (no-JS round trip), if it is still offered;
 *   2. on edit, the event's place (offered even when archived, E30);
 *   3. ?placeId= when it is one of the club's active places ("Opret event her");
 *   4. no places at all → "＋ Nyt sted";
 *   5. exactly one active place → that one;
 *   6. otherwise nothing: a wrong default house is worse than one tap.
 */
export function initialPlaceId(input: {
  places: readonly PlaceChoice[];
  echoed?: string | null;
  currentPlaceId?: string | null;
  prefillPlaceId?: string | null;
}): string {
  const { places } = input;
  const offered = (id: string | null | undefined) =>
    id === EVENT_PLACE_NEW || places.some((place) => place.id === id);
  if (input.echoed && offered(input.echoed)) return input.echoed;
  if (input.currentPlaceId && offered(input.currentPlaceId)) return input.currentPlaceId;

  const active = places.filter((place) => !place.archived);
  if (input.prefillPlaceId && active.some((place) => place.id === input.prefillPlaceId)) {
    return input.prefillPlaceId;
  }
  if (active.length === 0) return EVENT_PLACE_NEW;
  if (active.length === 1) return active[0]?.id ?? "";
  return "";
}

/**
 * The cards in view and the ones behind "Vis alle N steder" (more than six
 * places: the first five, last used first). `moreOpen`: the selected place is
 * hidden in the rest, so the <details> renders open.
 */
export function splitPlaceChoices<T extends { id: string }>(
  places: readonly T[],
  selectedId: string,
): { shown: T[]; more: T[]; moreOpen: boolean } {
  if (places.length <= PLACE_SELECTOR_LIMIT) {
    return { shown: [...places], more: [], moreOpen: false };
  }
  const shown = places.slice(0, PLACE_SELECTOR_SHOWN);
  const more = places.slice(PLACE_SELECTOR_SHOWN);
  return { shown, more, moreOpen: more.some((place) => place.id === selectedId) };
}

/** "Ejer: Mads" · "Ejere: Mads og Anders" · null without owners. */
export function ownersLabel(ownerNames: readonly string[]): string | null {
  if (ownerNames.length === 0) return null;
  return `${ownerNames.length === 1 ? "Ejer" : "Ejere"}: ${formatDanishList(ownerNames)}`;
}

/** A card's second line: "Søndergade 12 · Ejer: Mads", or null when there is nothing to add. */
export function placeChoiceMeta(place: Pick<PlaceChoice, "address" | "ownerNames">): string | null {
  const parts = [place.address, ownersLabel(place.ownerNames)].filter((part): part is string =>
    Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The active place the typed "＋ Nyt sted" name already belongs to (the same
 * key as the server, D-095), or null. Archived places do not count: the server
 * creates a new place next to them.
 */
export function existingPlaceForName<T extends PlaceChoice>(
  places: readonly T[],
  typedName: string,
): T | null {
  return findSamePlace(
    places.filter((place) => !place.archived),
    typedName,
  );
}

/**
 * The owners of the chosen place, for the host suggestion: an existing
 * place's owners; a new place is owned by the user when "Det er mit sted" is
 * ticked. Null when nothing is chosen.
 */
export function ownersOfChoice(input: {
  placeId: string;
  places: readonly PlaceChoice[];
  newPlaceMine: boolean;
  userId: string;
}): readonly string[] | null {
  if (input.placeId === EVENT_PLACE_NEW) return input.newPlaceMine ? [input.userId] : [];
  const place = input.places.find((candidate) => candidate.id === input.placeId);
  return place ? place.ownerIds : null;
}

/** The picker's suggestion for the chosen place, or null when no place is chosen. */
export function hostSuggestion(input: {
  ownerIds: readonly string[] | null;
  memberIds: ReadonlySet<string>;
  fallbackUserId: string;
}): HostSuggestion | null {
  if (input.ownerIds === null) return null;
  return suggestHosts({
    ownerIds: input.ownerIds,
    memberIds: input.memberIds,
    fallbackUserId: input.fallbackUserId,
  });
}

/** The picker's own state: untouched follows the suggestion; touched keeps the user's picks. */
export type HostsState = { touched: boolean; manual: readonly string[] };

/**
 * Where the picker starts. After a failed submit the echo is exactly what was
 * sent; on edit, the event's hosts. Either counts as the user's own choice
 * unless it equals the suggestion, so a place change still re-suggests.
 * Creating without an echo: untouched.
 */
export function initialHostsState(input: {
  echoed?: readonly string[] | null;
  existing?: readonly string[] | null;
  suggestion: HostSuggestion | null;
}): HostsState {
  const picked = input.echoed ?? input.existing ?? null;
  if (picked === null) return { touched: false, manual: [] };
  const suggested = input.suggestion?.hostIds ?? [];
  return { touched: !sameIdSet(picked, suggested), manual: [...picked] };
}

/** The hosts the picker shows checked (and the form sends). */
export function checkedHostIds(
  state: HostsState,
  suggestion: HostSuggestion | null,
): readonly string[] {
  return state.touched ? state.manual : (suggestion?.hostIds ?? []);
}

/** Toggles one host; the first toggle turns the suggestion into the user's own choice. */
export function toggleHost(
  state: HostsState,
  suggestion: HostSuggestion | null,
  userId: string,
  checked: boolean,
): HostsState {
  const current = checkedHostIds(state, suggestion).filter((id) => id !== userId);
  return { touched: true, manual: checked ? [...current, userId] : current };
}

/**
 * The polite live hint under the chips (SPEC §9.2 "Udfyldes automatisk med
 * stedets ejere … Kan justeres").
 */
export function hostsHint(input: {
  state: HostsState;
  suggestion: HostSuggestion | null;
  /** The suggestion's fallback is the person filling in the form ("du"). */
  fallbackIsSelf: boolean;
  /** Display name of the fallback when it is someone else (edit: the event's creator). */
  fallbackName: string;
}): string {
  const { state, suggestion } = input;
  if (state.touched) {
    return state.manual.length === 0
      ? `Vælger du ingen, bliver stedets ejere værter (eller ${
          input.fallbackIsSelf ? "du" : input.fallbackName
        }, hvis stedet ingen har).`
      : "Du har selv valgt værter.";
  }
  if (suggestion === null) return "Vælg et sted, så foreslår vi værter.";
  if (suggestion.reason === "owners") return "Udfyldt med stedets ejere.";
  return input.fallbackIsSelf
    ? "Stedet har ingen ejere, så du er vært."
    : `Stedet har ingen ejere, så ${input.fallbackName} er vært.`;
}

/** "Brug stedets ejere" is offered when the user's own picks differ from the place's owners. */
export function canUseOwners(state: HostsState, suggestion: HostSuggestion | null): boolean {
  return (
    state.touched && suggestion?.reason === "owners" && !sameIdSet(state.manual, suggestion.hostIds)
  );
}
