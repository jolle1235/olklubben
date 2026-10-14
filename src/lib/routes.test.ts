import { describe, expect, it } from "vitest";

import {
  beerHref,
  beersHref,
  clubHref,
  editBeerHref,
  editClubHref,
  editEventHref,
  editPlaceHref,
  editPollHref,
  eventHref,
  mapsSearchUrl,
  newBeerHref,
  newEventHref,
  newPlaceHref,
  newPollHref,
  overviewHref,
  placeHref,
  placesHref,
  pollHref,
  pollVoteHref,
  profileHref,
  songsHref,
} from "./routes";

const CLUB = "5eed0000-0000-7000-8000-0000000000c1";
const EVENT = "5eed0000-0000-7000-8000-0000000000e2";
const BEER = "5eed0000-0000-7000-8000-0000000000b1";
const PLACE = "5eed0000-0000-7000-8000-0000000000f1";

describe("club routes (SPEC §8.2)", () => {
  it("builds the event routes", () => {
    expect(overviewHref(CLUB)).toBe(`/c/${CLUB}`);
    expect(newEventHref(CLUB)).toBe(`/c/${CLUB}/events/new`);
    expect(newEventHref(CLUB, { date: null, placeId: "" })).toBe(`/c/${CLUB}/events/new`);
    expect(newEventHref(CLUB, { date: "2026-10-23" })).toBe(
      `/c/${CLUB}/events/new?date=2026-10-23`,
    );
    expect(newEventHref(CLUB, { placeId: PLACE })).toBe(`/c/${CLUB}/events/new?placeId=${PLACE}`);
    expect(newEventHref(CLUB, { date: "2026-10-23", placeId: PLACE })).toBe(
      `/c/${CLUB}/events/new?date=2026-10-23&placeId=${PLACE}`,
    );
    expect(eventHref(CLUB, EVENT)).toBe(`/c/${CLUB}/events/${EVENT}`);
    expect(editEventHref(CLUB, EVENT)).toBe(`/c/${CLUB}/events/${EVENT}/edit`);
  });

  it("builds the poll routes (round 4, D-138)", () => {
    const POLL = "5eed0000-0000-7000-8000-0000000001a1";
    expect(newPollHref(CLUB)).toBe(`/c/${CLUB}/polls/new`);
    expect(pollHref(CLUB, POLL)).toBe(`/c/${CLUB}/polls/${POLL}`);
    expect(editPollHref(CLUB, POLL)).toBe(`/c/${CLUB}/polls/${POLL}/edit`);
    expect(pollVoteHref(CLUB, POLL)).toBe(`/c/${CLUB}/polls/${POLL}#stem`);
  });

  it("builds the beer and songbook routes", () => {
    expect(beersHref(CLUB)).toBe(`/c/${CLUB}/beers`);
    expect(beerHref(CLUB, BEER)).toBe(`/c/${CLUB}/beers/${BEER}`);
    expect(editBeerHref(CLUB, BEER)).toBe(`/c/${CLUB}/beers/${BEER}/edit`);
    expect(songsHref(CLUB)).toBe(`/c/${CLUB}/songs`);
  });

  it("builds the place, club and profile routes (round 3, D-108)", () => {
    expect(placesHref(CLUB)).toBe(`/c/${CLUB}/places`);
    expect(newPlaceHref(CLUB)).toBe(`/c/${CLUB}/places/new`);
    expect(placeHref(CLUB, PLACE)).toBe(`/c/${CLUB}/places/${PLACE}`);
    expect(editPlaceHref(CLUB, PLACE)).toBe(`/c/${CLUB}/places/${PLACE}/edit`);
    expect(clubHref(CLUB)).toBe(`/c/${CLUB}/club`);
    expect(editClubHref(CLUB)).toBe(`/c/${CLUB}/club/edit`);
    expect(profileHref(CLUB)).toBe(`/c/${CLUB}/profile`);
  });

  it("pre-fills the event and the name on 'Tilføj øl' (SPEC §9.2, §10.5)", () => {
    expect(newBeerHref(CLUB)).toBe(`/c/${CLUB}/beers/new`);
    expect(newBeerHref(CLUB, { eventId: EVENT })).toBe(`/c/${CLUB}/beers/new?eventId=${EVENT}`);
    expect(newBeerHref(CLUB, { eventId: null, name: "" })).toBe(`/c/${CLUB}/beers/new`);
    const href = newBeerHref(CLUB, { eventId: EVENT, name: "Ørbæk & Co #2" });
    const url = new URL(href, "http://x");
    expect(url.searchParams.get("eventId")).toBe(EVENT);
    expect(url.searchParams.get("name")).toBe("Ørbæk & Co #2");
  });
});

describe("mapsSearchUrl (SPEC §9.2 'Åbn i kort')", () => {
  it("searches Google Maps for the free-text place", () => {
    expect(mapsSearchUrl("Søndergade 12, Tilst")).toBe(
      "https://www.google.com/maps/search/?api=1&query=S%C3%B8ndergade%2012%2C%20Tilst",
    );
  });

  it("encodes characters that would break the query", () => {
    const url = mapsSearchUrl("Bar & Bodega #2 / Århus");
    expect(url).not.toBeNull();
    expect(new URL(url as string).searchParams.get("query")).toBe("Bar & Bodega #2 / Århus");
  });

  it("collapses whitespace and line breaks", () => {
    const url = mapsSearchUrl("  Hos   Mads\n Tilst ");
    expect(new URL(url as string).searchParams.get("query")).toBe("Hos Mads Tilst");
  });

  it("gives null for an empty place", () => {
    expect(mapsSearchUrl("")).toBeNull();
    expect(mapsSearchUrl("   ")).toBeNull();
  });
});
