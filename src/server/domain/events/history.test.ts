import { describe, expect, it } from "vitest";

import {
  CALENDAR_HISTORY_LIMIT,
  OVERVIEW_HISTORY_LIMIT,
  pastEventMetaLabel,
  topRatedBeer,
} from "./history";

const beer = (name: string, averageStars: number | null, ratingCount: number) => ({
  name,
  averageStars,
  ratingCount,
});

describe("history limits (D-107)", () => {
  it("shows 3 on Overblik and 12 in the calendar list", () => {
    expect(OVERVIEW_HISTORY_LIMIT).toBe(3);
    expect(CALENDAR_HISTORY_LIMIT).toBe(12);
  });
});

describe("topRatedBeer", () => {
  it("picks the highest average", () => {
    const best = beer("Westmalle Tripel", 4.7, 3);
    expect(topRatedBeer([beer("Duvel", 4.25, 2), best, beer("Hvidtøl", 2.3, 3)])).toBe(best);
  });

  it("breaks a tie by more ratings, then by name (Danish order)", () => {
    const more = beer("Ølfabrikken", 4.5, 3);
    expect(topRatedBeer([beer("Abbaye", 4.5, 2), more])).toBe(more);
    const first = beer("Zwickel", 4.5, 2);
    expect(topRatedBeer([beer("Ærø Bryg", 4.5, 2), first])).toBe(first);
  });

  it("ignores unrated beers and returns null without ratings", () => {
    expect(topRatedBeer([beer("Ny øl", null, 0)])).toBeNull();
    expect(topRatedBeer([])).toBeNull();
    const rated = beer("Duvel", 3, 1);
    expect(topRatedBeer([beer("Ny øl", null, 0), rated])).toBe(rated);
  });
});

describe("pastEventMetaLabel", () => {
  it("shows the count and the best beer with its rating", () => {
    expect(
      pastEventMetaLabel({
        beerCount: 4,
        topBeer: { name: "Westmalle Tripel", averageStars: 4.666 },
      }),
    ).toBe("4 øl · Bedst: Westmalle Tripel ★ 4,7");
  });

  it("shows only the count when nothing is rated", () => {
    expect(pastEventMetaLabel({ beerCount: 1, topBeer: null })).toBe("1 øl");
  });

  it("says so when no beers were registered", () => {
    expect(pastEventMetaLabel({ beerCount: 0, topBeer: null })).toBe("Ingen øl registreret");
  });
});
