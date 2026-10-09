import { describe, expect, it } from "vitest";

import {
  BEER_SORT_LABELS,
  BEER_SORTS,
  beerCatalogSearch,
  compareBeerNames,
  DEFAULT_BEER_CATALOG_PARAMS,
  EVENT_FILTER_ALL,
  EVENT_FILTER_NONE,
  filterBeers,
  isFilteredCatalog,
  matchesBeerSearch,
  parseBeerCatalogParams,
  sortBeers,
  type CatalogBeer,
} from "./catalog";

const EVENT_A = "0199a000-0000-7000-8000-00000000e001";
const EVENT_B = "0199a000-0000-7000-8000-00000000e002";

let counter = 0;
function beer(fields: Partial<CatalogBeer> & { name: string }): CatalogBeer {
  counter += 1;
  return {
    id: `0199a000-0000-7000-8000-${String(counter).padStart(12, "0")}`,
    abv: 5,
    createdAt: new Date(Date.UTC(2026, 0, counter)),
    eventId: null,
    averageStars: null,
    ratingCount: 0,
    ...fields,
  };
}

const grimbergen = beer({ name: "Grimbergen Dubbel", abv: 6.5, averageStars: 4.5, ratingCount: 3, eventId: EVENT_A }); // prettier-ignore
const westmalle = beer({ name: "Westmalle Tripel", abv: 9.5, averageStars: 4.75, ratingCount: 2, eventId: EVENT_A }); // prettier-ignore
const hvidtol = beer({ name: "Carlsberg Hvidtøl", abv: 1.9, averageStars: 2.5, ratingCount: 3, eventId: EVENT_A }); // prettier-ignore
const orbaek = beer({ name: "Ørbæk Fynsk Forår", abv: 5, averageStars: 4.5, ratingCount: 1, eventId: null }); // prettier-ignore
const unratedA = beer({ name: "Anchor Steam", abv: 4.9, eventId: EVENT_B });
const unratedAe = beer({ name: "Æblemost Ale", abv: 4.5 });

const all = [grimbergen, westmalle, hvidtol, orbaek, unratedA, unratedAe];
const names = (beers: CatalogBeer[]) => beers.map((b) => b.name);

describe("sortBeers (SPEC §9.5)", () => {
  it("best rating: highest average first, unrated last (by name)", () => {
    expect(names(sortBeers(all, "rating"))).toEqual([
      "Westmalle Tripel",
      // 4,5 each: more ratings first.
      "Grimbergen Dubbel",
      "Ørbæk Fynsk Forår",
      "Carlsberg Hvidtøl",
      "Anchor Steam",
      "Æblemost Ale",
    ]);
  });

  it("most ratings: count first, then average, unrated last", () => {
    expect(names(sortBeers(all, "most-rated"))).toEqual([
      "Grimbergen Dubbel",
      "Carlsberg Hvidtøl",
      "Westmalle Tripel",
      "Ørbæk Fynsk Forår",
      "Anchor Steam",
      "Æblemost Ale",
    ]);
  });

  it("newest: latest createdAt first", () => {
    expect(names(sortBeers(all, "newest"))).toEqual([
      "Æblemost Ale",
      "Anchor Steam",
      "Ørbæk Fynsk Forår",
      "Carlsberg Hvidtøl",
      "Westmalle Tripel",
      "Grimbergen Dubbel",
    ]);
  });

  it("alcohol high → low and low → high, ties by name", () => {
    expect(names(sortBeers(all, "abv-desc")).slice(0, 2)).toEqual([
      "Westmalle Tripel",
      "Grimbergen Dubbel",
    ]);
    expect(names(sortBeers(all, "abv-asc"))).toEqual([
      "Carlsberg Hvidtøl",
      "Æblemost Ale",
      "Anchor Steam",
      "Ørbæk Fynsk Forår",
      "Grimbergen Dubbel",
      "Westmalle Tripel",
    ]);
    const tie = [beer({ name: "Zulu", abv: 5 }), beer({ name: "Alfa", abv: 5 })];
    expect(names(sortBeers(tie, "abv-desc"))).toEqual(["Alfa", "Zulu"]);
  });

  it("name A–Å puts Æ, Ø and Å after Z", () => {
    const list = ["Øl", "Åben", "Zulu", "Æble", "Ale", "øko"].map((name) => beer({ name }));
    expect(names(sortBeers(list, "name"))).toEqual(["Ale", "Zulu", "Æble", "øko", "Øl", "Åben"]);
  });

  it("name sorts numbers by value", () => {
    const list = ["IPA 10", "IPA 2"].map((name) => beer({ name }));
    expect(names(sortBeers(list, "name"))).toEqual(["IPA 2", "IPA 10"]);
  });

  it("is stable for identical beers (tie-break on id) and does not change the input", () => {
    const twinA = beer({ name: "Tvilling" });
    const twinB = beer({ name: "Tvilling" });
    expect(sortBeers([twinB, twinA], "name")).toEqual([twinA, twinB]);
    expect(sortBeers([twinB, twinA], "rating")).toEqual([twinA, twinB]);
    const input = [...all];
    sortBeers(input, "name");
    expect(input).toEqual(all);
  });

  it("has a Danish label for every sort", () => {
    for (const sort of BEER_SORTS) expect(BEER_SORT_LABELS[sort]).toBeTruthy();
    expect(BEER_SORT_LABELS.name).toBe("Navn (A–Å)");
  });

  it("compareBeerNames orders A–Å", () => {
    expect(compareBeerNames({ id: "1", name: "Å" }, { id: "2", name: "Z" })).toBeGreaterThan(0);
  });
});

describe("matchesBeerSearch / filterBeers", () => {
  it("searches case-insensitively, also æ/ø/å", () => {
    expect(matchesBeerSearch("Carlsberg Hvidtøl", "HVIDTØL")).toBe(true);
    expect(matchesBeerSearch("Ørbæk Fynsk Forår", "ørbæk")).toBe(true);
    expect(matchesBeerSearch("Ørbæk Fynsk Forår", "  fynsk   forår ")).toBe(true);
    expect(matchesBeerSearch("Carlsberg Hvidtøl", "hvidtol")).toBe(false);
    expect(matchesBeerSearch("Westmalle", "")).toBe(true);
  });

  it("filters by event, by 'without event' and by search together", () => {
    expect(names(filterBeers(all, { event: EVENT_A }))).toEqual([
      "Grimbergen Dubbel",
      "Westmalle Tripel",
      "Carlsberg Hvidtøl",
    ]);
    expect(names(filterBeers(all, { event: EVENT_FILTER_NONE }))).toEqual([
      "Ørbæk Fynsk Forår",
      "Æblemost Ale",
    ]);
    expect(names(filterBeers(all, { event: EVENT_A, query: "tripel" }))).toEqual([
      "Westmalle Tripel",
    ]);
    expect(filterBeers(all, { event: EVENT_FILTER_ALL })).toEqual(all);
    expect(filterBeers(all, {})).toEqual(all);
    expect(filterBeers(all, { event: "0199a000-0000-7000-8000-00000000ffff" })).toEqual([]);
  });
});

describe("parseBeerCatalogParams (untrusted searchParams)", () => {
  it("gives the defaults for nothing", () => {
    expect(parseBeerCatalogParams({})).toEqual(DEFAULT_BEER_CATALOG_PARAMS);
    expect(DEFAULT_BEER_CATALOG_PARAMS).toEqual({ q: "", sort: "rating", event: "all" });
  });

  it("reads valid values (first of repeated keys)", () => {
    expect(parseBeerCatalogParams({ q: "  ipa ", sort: "name", event: EVENT_B })).toEqual({
      q: "ipa",
      sort: "name",
      event: EVENT_B,
    });
    expect(parseBeerCatalogParams({ sort: ["abv-asc", "name"], event: "none" })).toMatchObject({
      sort: "abv-asc",
      event: "none",
    });
  });

  it("falls back for unknown sorts and malformed event ids, and cuts long searches", () => {
    expect(parseBeerCatalogParams({ sort: "DROP TABLE", event: "123" })).toEqual(
      DEFAULT_BEER_CATALOG_PARAMS,
    );
    expect(parseBeerCatalogParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("beerCatalogSearch / isFilteredCatalog", () => {
  it("leaves out defaults", () => {
    expect(beerCatalogSearch(DEFAULT_BEER_CATALOG_PARAMS)).toBe("");
    expect(beerCatalogSearch({ q: "øl & mad", sort: "name", event: EVENT_A })).toBe(
      `?q=%C3%B8l+%26+mad&sort=name&event=${EVENT_A}`,
    );
  });

  it("knows when a filter is active", () => {
    expect(isFilteredCatalog(DEFAULT_BEER_CATALOG_PARAMS)).toBe(false);
    expect(isFilteredCatalog({ q: "ipa", event: EVENT_FILTER_ALL })).toBe(true);
    expect(isFilteredCatalog({ q: "", event: EVENT_FILTER_NONE })).toBe(true);
  });
});
