import { describe, expect, it } from "vitest";

import {
  averageFromSum,
  averageRating,
  averageRatingAriaLabel,
  formatRating,
  formatStars,
  isValidRatingValue,
  RATING_MAX,
  RATING_MIN,
  RATING_VALUES,
  ratingAriaLabel,
  ratingCountLabel,
  ratingToStars,
  roundToTenth,
  starFills,
  starsToRating,
} from "./ratings";

describe("rating values (D-003)", () => {
  it("are the integers 2..10", () => {
    expect(RATING_MIN).toBe(2);
    expect(RATING_MAX).toBe(10);
    expect(RATING_VALUES).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("isValidRatingValue accepts only integers 2..10", () => {
    for (const value of RATING_VALUES) expect(isValidRatingValue(value)).toBe(true);
    for (const value of [0, 1, 11, 4.5, -2, Number.NaN, "8", null, undefined]) {
      expect(isValidRatingValue(value), String(value)).toBe(false);
    }
  });
});

describe("stars ↔ value", () => {
  it("converts half points to stars and back", () => {
    expect(ratingToStars(2)).toBe(1);
    expect(ratingToStars(9)).toBe(4.5);
    expect(ratingToStars(10)).toBe(5);
    expect(starsToRating(1)).toBe(2);
    expect(starsToRating(4.5)).toBe(9);
    expect(starsToRating(5)).toBe(10);
  });

  it("refuses stars that are not whole or half stars from 1 to 5", () => {
    for (const stars of [0, 0.5, 5.5, 4.25, Number.NaN]) {
      expect(starsToRating(stars), String(stars)).toBeNull();
    }
  });
});

describe("averageRating (computed on read, §3.4)", () => {
  it("is the mean in stars, or null without ratings", () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([10])).toBe(5);
    expect(averageRating([9, 8])).toBe(4.25);
    expect(averageRating([10, 9, 9])).toBeCloseTo(4.6667, 4);
  });

  it("averageFromSum gives the same from a GROUP BY's sum and count (D-073)", () => {
    expect(averageFromSum(0, 0)).toBeNull();
    expect(averageFromSum(19, 2)).toBe(4.75);
    expect(averageFromSum(10, 1)).toBe(5);
    expect(averageFromSum(28, 3)).toBe(averageRating([10, 9, 9]));
  });
});

describe("roundToTenth / formatRating", () => {
  it("rounds half up without float surprises", () => {
    expect(roundToTenth(4.35)).toBe(4.4);
    expect(roundToTenth(4.25)).toBe(4.3);
    expect(roundToTenth(4.24)).toBe(4.2);
    // 87 half points over 10 ratings: 4.35 stars exactly → "4,4".
    expect(formatRating(87 / 10 / 2)).toBe("4,4");
  });

  it("always shows one decimal with a comma (§4.6 '4,3')", () => {
    expect(formatRating(4.25)).toBe("4,3");
    expect(formatRating(4)).toBe("4,0");
    expect(formatRating(5)).toBe("5,0");
    expect(formatRating(4.6667)).toBe("4,7");
    expect(formatRating(Number.NaN)).toBe("");
  });
});

describe("formatStars / aria labels", () => {
  it("shows one member's rating without a needless ',0'", () => {
    expect(formatStars(10)).toBe("5");
    expect(formatStars(9)).toBe("4,5");
    expect(formatStars(2)).toBe("1");
    expect(formatStars(3)).toBe("1,5");
  });

  it("reads '4,5 ud af 5' (§9.5)", () => {
    expect(ratingAriaLabel(9)).toBe("4,5 ud af 5");
    expect(ratingAriaLabel(10)).toBe("5 ud af 5");
    expect(averageRatingAriaLabel(4.25)).toBe("4,3 ud af 5");
  });
});

describe("ratingCountLabel", () => {
  it("counts in Danish", () => {
    expect(ratingCountLabel(0)).toBe("Ingen ratings endnu");
    expect(ratingCountLabel(1)).toBe("1 rating");
    expect(ratingCountLabel(12)).toBe("12 ratings");
  });
});

describe("starFills", () => {
  it("rounds to the nearest half star", () => {
    expect(starFills(4.3)).toEqual(["full", "full", "full", "full", "half"]);
    expect(starFills(4.2)).toEqual(["full", "full", "full", "full", "empty"]);
    expect(starFills(4.75)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(1)).toEqual(["full", "empty", "empty", "empty", "empty"]);
  });

  it("is empty without a rating and clamps out-of-range values", () => {
    expect(starFills(null)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
    expect(starFills(7)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(-1)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });
});
