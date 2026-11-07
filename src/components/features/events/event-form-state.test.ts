import { describe, expect, it } from "vitest";

import {
  canUseOwners,
  checkedHostIds,
  existingPlaceForName,
  hostSuggestion,
  hostsHint,
  initialHostsState,
  initialPlaceId,
  ownersLabel,
  ownersOfChoice,
  placeChoiceMeta,
  splitPlaceChoices,
  toggleHost,
  toHostChoices,
  toPlaceChoices,
  type PlaceChoice,
} from "./event-form-state";

const ME = "u-me";
const MADS = "u-mads";
const ANDERS = "u-anders";
const GONE = "u-gone";
const MEMBERS = new Set([ME, MADS, ANDERS]);

function place(id: string, overrides: Partial<PlaceChoice> = {}): PlaceChoice {
  return {
    id,
    name: `Sted ${id}`,
    address: null,
    archived: false,
    ownerIds: [],
    ownerNames: [],
    ...overrides,
  };
}

const hosMads = place("p-mads", { name: "Hos Mads", ownerIds: [MADS], ownerNames: ["Mads"] });
const baren = place("p-bar", { name: "Den lokale bar" });
const gammel = place("p-old", { name: "Det gamle klubhus", archived: true });

describe("initialPlaceId", () => {
  it("starts at 'Ikke bestemt endnu' when nothing points at a place (D-175)", () => {
    expect(initialPlaceId({ places: [] })).toBe("");
    expect(initialPlaceId({ places: [hosMads] })).toBe("");
    expect(initialPlaceId({ places: [hosMads, baren] })).toBe("");
  });

  it("keeps an echoed 'Ikke bestemt endnu' over the event's place", () => {
    expect(initialPlaceId({ places: [hosMads], echoed: "", currentPlaceId: "p-mads" })).toBe("");
  });

  it("honours ?placeId= only for an active place of the club", () => {
    const places = [hosMads, baren, gammel];
    expect(initialPlaceId({ places, prefillPlaceId: "p-bar" })).toBe("p-bar");
    expect(initialPlaceId({ places, prefillPlaceId: "p-old" })).toBe("");
    expect(initialPlaceId({ places, prefillPlaceId: "p-other-club" })).toBe("");
    expect(initialPlaceId({ places, prefillPlaceId: "new" })).toBe("");
  });

  it("keeps the event's place on edit, also when it is archived (E30)", () => {
    expect(initialPlaceId({ places: [hosMads, gammel], currentPlaceId: "p-old" })).toBe("p-old");
  });

  it("prefers the echo of a failed submit when it is still offered", () => {
    const places = [hosMads, baren];
    expect(initialPlaceId({ places, echoed: "p-bar", currentPlaceId: "p-mads" })).toBe("p-bar");
    expect(initialPlaceId({ places, echoed: "new", currentPlaceId: "p-mads" })).toBe("new");
    expect(initialPlaceId({ places, echoed: "p-forged", currentPlaceId: "p-mads" })).toBe("p-mads");
  });
});

describe("splitPlaceChoices", () => {
  const many = ["a", "b", "c", "d", "e", "f", "g"].map((id) => place(id));

  it("shows up to six places as they are", () => {
    expect(splitPlaceChoices(many.slice(0, 6), "")).toEqual({
      shown: many.slice(0, 6),
      more: [],
      moreOpen: false,
    });
  });

  it("shows five and hides the rest behind 'Vis alle', open when the choice is hidden", () => {
    const split = splitPlaceChoices(many, "a");
    expect(split.shown.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(split.more.map((p) => p.id)).toEqual(["f", "g"]);
    expect(split.moreOpen).toBe(false);
    expect(splitPlaceChoices(many, "g").moreOpen).toBe(true);
  });
});

describe("card texts", () => {
  it("names the owners in Danish", () => {
    expect(ownersLabel([])).toBeNull();
    expect(ownersLabel(["Mads"])).toBe("Ejer: Mads");
    expect(ownersLabel(["Mads", "Anders"])).toBe("Ejere: Mads og Anders");
  });

  it("joins address and owners", () => {
    expect(placeChoiceMeta({ address: "Søndergade 12", ownerNames: ["Mads"] })).toBe(
      "Søndergade 12 · Ejer: Mads",
    );
    expect(placeChoiceMeta({ address: null, ownerNames: ["Mads"] })).toBe("Ejer: Mads");
    expect(placeChoiceMeta({ address: "Tilst", ownerNames: [] })).toBe("Tilst");
    expect(placeChoiceMeta({ address: null, ownerNames: [] })).toBeNull();
  });
});

describe("existingPlaceForName", () => {
  it("finds an active place with the same key, never an archived one", () => {
    const places = [hosMads, gammel];
    expect(existingPlaceForName(places, "  hos   MADS ")?.id).toBe("p-mads");
    expect(existingPlaceForName(places, "Det gamle klubhus")).toBeNull();
    expect(existingPlaceForName(places, "Hos Anders")).toBeNull();
    expect(existingPlaceForName(places, "")).toBeNull();
  });
});

describe("host suggestion", () => {
  const places = [hosMads, baren];

  it("follows the chosen place: owners, new place mine or not, nothing chosen", () => {
    expect(ownersOfChoice({ placeId: "p-mads", places, newPlaceMine: false, userId: ME })).toEqual([
      MADS,
    ]);
    expect(ownersOfChoice({ placeId: "new", places, newPlaceMine: true, userId: ME })).toEqual([
      ME,
    ]);
    expect(ownersOfChoice({ placeId: "new", places, newPlaceMine: false, userId: ME })).toEqual([]);
    expect(ownersOfChoice({ placeId: "", places, newPlaceMine: false, userId: ME })).toBeNull();
  });

  it("suggests the owners who are members, else nobody", () => {
    expect(hostSuggestion({ ownerIds: [MADS], memberIds: MEMBERS })).toEqual({
      hostIds: [MADS],
      reason: "owners",
    });
    expect(hostSuggestion({ ownerIds: [GONE], memberIds: MEMBERS })).toEqual({
      hostIds: [],
      reason: "none",
    });
    expect(hostSuggestion({ ownerIds: null, memberIds: MEMBERS })).toBeNull();
  });
});

describe("server data → form props", () => {
  const person = (id: string, name: string, nickname: string | null = null) => ({
    id,
    name,
    nickname,
    image: null,
  });

  it("lists members, then hosts who have left (each once)", () => {
    const members = [person(MADS, "Mads"), person(ME, "Jesper Thomsen", "Kaptajnen")];
    expect(toHostChoices(members, [person(MADS, "Mads"), person(GONE, "Bo")])).toEqual([
      { id: MADS, displayName: "Mads", image: null, former: false },
      { id: ME, displayName: "Kaptajnen", image: null, former: false },
      { id: GONE, displayName: "Bo", image: null, former: true },
    ]);
  });

  it("keeps only what the selector needs", () => {
    const option = { ...hosMads, lastUsedAt: new Date() };
    expect(toPlaceChoices([option])).toEqual([hosMads]);
  });
});

describe("HostsPicker state", () => {
  const owners = { hostIds: [MADS], reason: "owners" as const };
  const none = { hostIds: [], reason: "none" as const };

  it("starts untouched when creating, and follows the suggestion", () => {
    const state = initialHostsState({ suggestion: owners });
    expect(state).toEqual({ touched: false, manual: [] });
    expect(checkedHostIds(state, owners)).toEqual([MADS]);
    expect(checkedHostIds(state, none)).toEqual([]);
    expect(checkedHostIds(state, null)).toEqual([]);
  });

  it("treats the event's hosts as the user's own choice unless they equal the suggestion", () => {
    expect(initialHostsState({ existing: [MADS], suggestion: owners }).touched).toBe(false);
    expect(initialHostsState({ existing: [ANDERS, GONE], suggestion: owners })).toEqual({
      touched: true,
      manual: [ANDERS, GONE],
    });
  });

  it("shows exactly the echo after a failed submit, also an empty one", () => {
    expect(initialHostsState({ echoed: [], existing: [MADS], suggestion: owners })).toEqual({
      touched: true,
      manual: [],
    });
    expect(initialHostsState({ echoed: [], suggestion: null })).toEqual({
      touched: false,
      manual: [],
    });
  });

  it("the first toggle turns the suggestion into the user's own picks", () => {
    const untouched = initialHostsState({ suggestion: owners });
    const added = toggleHost(untouched, owners, ANDERS, true);
    expect(added).toEqual({ touched: true, manual: [MADS, ANDERS] });
    // A place change no longer moves them.
    expect(checkedHostIds(added, none)).toEqual([MADS, ANDERS]);
    expect(toggleHost(added, none, MADS, false)).toEqual({ touched: true, manual: [ANDERS] });
  });

  it("offers 'Brug stedets ejere' only when the picks differ from the place's owners", () => {
    const own = { touched: true, manual: [ANDERS] };
    expect(canUseOwners(own, owners)).toBe(true);
    expect(canUseOwners({ touched: true, manual: [MADS] }, owners)).toBe(false);
    expect(canUseOwners(own, none)).toBe(false);
    expect(canUseOwners({ touched: false, manual: [] }, owners)).toBe(false);
  });

  it("explains the hosts in plain Danish, and never makes the user host (D-175)", () => {
    const untouched = { touched: false, manual: [] };
    expect(hostsHint({ state: untouched, suggestion: null })).toBe(
      "Ingen værter endnu. Vælg selv, eller vælg et sted med ejere.",
    );
    expect(hostsHint({ state: untouched, suggestion: owners })).toBe("Udfyldt med stedets ejere.");
    expect(hostsHint({ state: untouched, suggestion: none })).toBe(
      "Stedet har ingen ejere. Vælg selv værter, eller lad det stå åbent.",
    );
    expect(hostsHint({ state: { touched: true, manual: [ME] }, suggestion: owners })).toBe(
      "Du har selv valgt værter.",
    );
    expect(hostsHint({ state: { touched: true, manual: [] }, suggestion: owners })).toBe(
      "Vælger du ingen, bliver stedets ejere værter, hvis det har nogen.",
    );
  });
});
