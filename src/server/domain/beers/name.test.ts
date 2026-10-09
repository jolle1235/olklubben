import { describe, expect, it } from "vitest";

import {
  beerDuplicateKey,
  cleanBeerName,
  findSameNameBeers,
  isSameBeerName,
  normalizeBeerName,
} from "./name";

describe("cleanBeerName", () => {
  it("trims and collapses whitespace, keeps the case", () => {
    expect(cleanBeerName("  Westmalle   Tripel ")).toBe("Westmalle Tripel");
    expect(cleanBeerName("Grimbergen\tDubbel\n")).toBe("Grimbergen Dubbel");
  });

  it("uses one Unicode form for æ/ø/å", () => {
    // "å" can also arrive as "a" + a combining ring (e.g. pasted from macOS).
    expect(cleanBeerName("Kårsø")).toBe("Kårsø");
  });

  it("removes NUL characters, which Postgres text cannot store", () => {
    expect(cleanBeerName("Westmalle\u0000 Tripel")).toBe("Westmalle Tripel");
    expect(cleanBeerName("\u0000")).toBe("");
  });
});

describe("normalizeBeerName (search key)", () => {
  it("ignores case and extra whitespace, keeps word boundaries", () => {
    expect(normalizeBeerName("  WESTMALLE  tripel")).toBe("westmalle tripel");
  });

  it("lower-cases æ, ø and å", () => {
    expect(normalizeBeerName("ÆBLEØL FRA ÅRHUS")).toBe("æbleøl fra århus");
  });
});

describe("beerDuplicateKey and isSameBeerName (duplicate warning, E21)", () => {
  it("ignores case and all whitespace", () => {
    expect(beerDuplicateKey("  Grimbergen  DUBBEL ")).toBe("grimbergendubbel");
    expect(isSameBeerName("Westmalle Tripel", " westmalle   TRIPEL ")).toBe(true);
    expect(isSameBeerName("Grimbergen Dubbel", "GrimbergenDubbel")).toBe(true);
    expect(isSameBeerName("Mikkeller Beer Geek Breakfast", "Mikkeller BeerGeek Breakfast")).toBe(
      true,
    );
  });

  it("lower-cases æ, ø and å", () => {
    expect(isSameBeerName("Ørbæk Fynsk Forår", "ØRBÆK FYNSK FORÅR")).toBe(true);
  });

  it("keeps different letters apart", () => {
    expect(isSameBeerName("Carlsberg", "Carlsberg Hvidtøl")).toBe(false);
    expect(isSameBeerName("Aarhus", "Århus")).toBe(false);
  });
});

describe("findSameNameBeers", () => {
  const beers = [
    { id: "a", name: "Ørbæk Fynsk Forår", abv: 5 },
    { id: "b", name: "Duvel", abv: 8.5 },
    { id: "c", name: "duvel", abv: 8.5 },
    { id: "d", name: "Grimbergen Dubbel", abv: 6.5 },
  ];

  it("matches regardless of case and whitespace, also for æ/ø/å", () => {
    expect(findSameNameBeers(beers, "  ØRBÆK   fynsk forår ").map((b) => b.id)).toEqual(["a"]);
    expect(findSameNameBeers(beers, "DUVEL").map((b) => b.id)).toEqual(["b", "c"]);
    expect(findSameNameBeers(beers, "GrimbergenDubbel").map((b) => b.id)).toEqual(["d"]);
  });

  it("does not match parts of a name or an empty name", () => {
    expect(findSameNameBeers(beers, "Duv")).toEqual([]);
    expect(findSameNameBeers(beers, "   ")).toEqual([]);
    expect(findSameNameBeers(beers, "")).toEqual([]);
  });

  it("leaves out the beer being edited", () => {
    expect(findSameNameBeers(beers, "Duvel", "b").map((b) => b.id)).toEqual(["c"]);
  });
});
