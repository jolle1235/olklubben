import { describe, expect, it } from "vitest";

import {
  cleanPlaceName,
  comparePlacesByName,
  findSamePlace,
  isSamePlaceName,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_DESCRIPTION_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  placeNameKey,
} from "./name";

describe("place name limits (D-095)", () => {
  it("allows 120 characters, so round 2's free text migrates without loss", () => {
    expect(PLACE_NAME_MAX_LENGTH).toBe(120);
    expect(PLACE_ADDRESS_MAX_LENGTH).toBe(200);
    expect(PLACE_DESCRIPTION_MAX_LENGTH).toBe(1000);
  });
});

describe("cleanPlaceName", () => {
  it("collapses whitespace (also NBSP), trims and removes NUL", () => {
    expect(cleanPlaceName("  Hos\u00a0\u00a0Mads \n")).toBe("Hos Mads");
    expect(cleanPlaceName("Hos\u0000 Mads")).toBe("Hos Mads");
  });

  it("normalizes to NFC", () => {
    expect(cleanPlaceName("Cafe\u0301 Noir")).toBe("Café Noir");
  });
});

describe("placeNameKey (the migration's fixtures)", () => {
  it("makes the four spellings of Hos Mads one key", () => {
    const keys = ["Hos Mads", " hos  MADS ", "HOS Mads", "Hos\u00a0Mads", "HosMads"].map(
      placeNameKey,
    );
    expect(new Set(keys)).toEqual(new Set(["hosmads"]));
  });

  it("folds Æ/Ø/Å", () => {
    expect(placeNameKey("Ærø")).toBe(placeNameKey("ÆRØ"));
    expect(placeNameKey("ÆRØ")).toBe("ærø");
  });

  it("keeps punctuation and digits", () => {
    expect(placeNameKey("Søndergade 12, Tilst")).toBe("søndergade12,tilst");
  });

  it("is empty for NBSP only", () => {
    expect(placeNameKey("\u00a0\u00a0")).toBe("");
  });
});

describe("isSamePlaceName", () => {
  it("ignores case and whitespace", () => {
    expect(isSamePlaceName("Hos Mads", "hos  mads")).toBe(true);
    expect(isSamePlaceName("Hos Mads", "Hos Anders")).toBe(false);
  });

  it("never matches empty names", () => {
    expect(isSamePlaceName("", "")).toBe(false);
    expect(isSamePlaceName(" ", "\u00a0")).toBe(false);
  });
});

describe("findSamePlace", () => {
  const places = [
    { id: "p1", name: "Hos Mads" },
    { id: "p2", name: "Hos Anders" },
    { id: "p3", name: "HOS MADS" },
  ];

  it("returns the first place with the same key", () => {
    expect(findSamePlace(places, " hos mads ")).toEqual(places[0]);
  });

  it("leaves out the place being edited", () => {
    expect(findSamePlace(places, "Hos Mads", "p1")).toEqual(places[2]);
    expect(findSamePlace(places, "Hos Anders", "p2")).toBeNull();
  });

  it("matches nothing for an empty name or an unknown one", () => {
    expect(findSamePlace(places, "   ")).toBeNull();
    expect(findSamePlace(places, "Bodegaen")).toBeNull();
  });
});

describe("comparePlacesByName", () => {
  it("sorts the Danish way (Æ, Ø, Å after Z; upper case first), then spelling, then id", () => {
    const places = [
      { id: "b", name: "Åen" },
      { id: "a", name: "Zoo" },
      { id: "c", name: "Ærø" },
      { id: "e", name: "hos mads" },
      { id: "d", name: "Hos Mads" },
      { id: "f", name: "Hos Mads" },
    ];
    expect([...places].sort(comparePlacesByName).map((place) => place.id)).toEqual([
      "d",
      "f",
      "e",
      "a",
      "c",
      "b",
    ]);
  });
});
