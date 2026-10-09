import { describe, expect, it } from "vitest";

import {
  beerCountLabel,
  catalogResultLabel,
  deleteBeerDescription,
  eventFilterOptions,
  mergeBeersById,
  resolveEventFilter,
  toEventChoices,
} from "./catalog-view";

const E1 = "0199a000-0000-7000-8000-0000000000e1";
const E2 = "0199a000-0000-7000-8000-0000000000e2";
const E3 = "0199a000-0000-7000-8000-0000000000e3";
const events = [{ id: E3 }, { id: E2 }, { id: E1 }];

describe("resolveEventFilter", () => {
  it("keeps all, none and the club's own events", () => {
    expect(resolveEventFilter("all", events)).toBe("all");
    expect(resolveEventFilter("none", events)).toBe("none");
    expect(resolveEventFilter(E2, events)).toBe(E2);
  });

  it("falls back to all for an event that is not in the club", () => {
    expect(resolveEventFilter("0199a000-0000-7000-8000-00000000ffff", events)).toBe("all");
    expect(resolveEventFilter(E1, [])).toBe("all");
  });
});

describe("eventFilterOptions", () => {
  const beers = [{ eventId: E1 }, { eventId: null }, { eventId: E1 }];

  it("offers only events with beers, in the given order", () => {
    expect(eventFilterOptions(events, beers, "all")).toEqual([{ id: E1 }]);
  });

  it("keeps the active event even without beers", () => {
    expect(eventFilterOptions(events, beers, E3)).toEqual([{ id: E3 }, { id: E1 }]);
  });

  it("is empty for a catalogue without events", () => {
    expect(eventFilterOptions([], beers, "none")).toEqual([]);
  });
});

describe("labels", () => {
  it("counts beers with the same word in singular and plural", () => {
    expect(beerCountLabel(1)).toBe("1 øl");
    expect(beerCountLabel(6)).toBe("6 øl");
  });

  it("says how many are shown when filtered", () => {
    expect(catalogResultLabel(6, 6)).toBe("6 øl");
    expect(catalogResultLabel(2, 6)).toBe("Viser 2 af 6 øl");
    expect(catalogResultLabel(0, 6)).toBe("Viser 0 af 6 øl");
  });
});

describe("mergeBeersById", () => {
  it("keeps the first list's order and drops repeats", () => {
    expect(mergeBeersById([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }])).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });
});

describe("deleteBeerDescription", () => {
  it("says how many ratings are deleted with the beer (E14)", () => {
    expect(deleteBeerDescription(0)).toBe("Øllen bliver slettet. Det kan ikke fortrydes.");
    expect(deleteBeerDescription(1)).toBe(
      "Øllen og dens ene rating bliver slettet. Det kan ikke fortrydes.",
    );
    expect(deleteBeerDescription(12)).toBe(
      "Øllen og dens 12 ratings bliver slettet. Det kan ikke fortrydes.",
    );
  });
});

describe("toEventChoices", () => {
  it("labels an event with its title and Copenhagen date", () => {
    // 22:30 UTC on 14 September is already 15 September in Copenhagen.
    const startsAt = new Date("2026-09-14T22:30:00Z");
    expect(toEventChoices([{ id: E1, title: "Ølsmagning #12", startsAt }])).toEqual([
      { id: E1, label: "Ølsmagning #12 · 15. sep 2026" },
    ]);
  });
});
