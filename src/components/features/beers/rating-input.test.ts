import { describe, expect, it } from "vitest";

import { RATING_VALUES } from "@/server/domain/ratings/ratings";

import { ratingAfterKey, ratingAtX, starHitValues } from "./rating-input";

describe("starHitValues", () => {
  it("gives the first star one hit area (1 star; no half star below 1)", () => {
    expect(starHitValues(0)).toEqual([2]);
  });

  it("gives the other stars a half (left) and a whole (right)", () => {
    expect(starHitValues(1)).toEqual([3, 4]);
    expect(starHitValues(3)).toEqual([7, 8]);
    expect(starHitValues(4)).toEqual([9, 10]);
  });

  it("covers the nine stored values exactly once, in order", () => {
    const all = [0, 1, 2, 3, 4].flatMap((index) => starHitValues(index));
    expect(all).toEqual(RATING_VALUES);
  });

  it("returns nothing for a star that does not exist", () => {
    expect(starHitValues(-1)).toEqual([]);
    expect(starHitValues(5)).toEqual([]);
    expect(starHitValues(1.5)).toEqual([]);
  });
});

describe("ratingAfterKey", () => {
  it("steps half a star with the arrows (Right/Up up, Left/Down down)", () => {
    expect(ratingAfterKey(6, "ArrowRight")).toBe(7);
    expect(ratingAfterKey(6, "ArrowUp")).toBe(7);
    expect(ratingAfterKey(6, "ArrowLeft")).toBe(5);
    expect(ratingAfterKey(6, "ArrowDown")).toBe(5);
  });

  it("clamps at 1 and 5 stars instead of wrapping around", () => {
    expect(ratingAfterKey(10, "ArrowRight")).toBe(10);
    expect(ratingAfterKey(2, "ArrowLeft")).toBe(2);
  });

  it("jumps to the ends with Home and End", () => {
    expect(ratingAfterKey(7, "Home")).toBe(2);
    expect(ratingAfterKey(7, "End")).toBe(10);
    expect(ratingAfterKey(null, "End")).toBe(10);
  });

  it("starts at 1 star from no rating", () => {
    expect(ratingAfterKey(null, "ArrowRight")).toBe(2);
    expect(ratingAfterKey(null, "ArrowLeft")).toBe(2);
  });

  it("ignores other keys", () => {
    expect(ratingAfterKey(6, "Tab")).toBeUndefined();
    expect(ratingAfterKey(6, " ")).toBeUndefined();
    expect(ratingAfterKey(null, "Enter")).toBeUndefined();
  });
});

describe("ratingAtX", () => {
  // Five 50 px stars with 6 px gaps, as getBoundingClientRect gives them.
  const stars = [0, 1, 2, 3, 4].map((i) => ({ left: i * 56, right: i * 56 + 50 }));

  it("gives a half star on the left half and a whole star on the right half", () => {
    expect(ratingAtX(60, stars)).toBe(3);
    expect(ratingAtX(100, stars)).toBe(4);
    expect(ratingAtX(230, stars)).toBe(9);
    expect(ratingAtX(270, stars)).toBe(10);
  });

  it("gives 1 star anywhere on the first star (there is no ½)", () => {
    expect(ratingAtX(5, stars)).toBe(2);
    expect(ratingAtX(45, stars)).toBe(2);
  });

  it("splits the gap between two stars halfway", () => {
    expect(ratingAtX(52.9, stars)).toBe(2);
    expect(ratingAtX(53.1, stars)).toBe(3);
  });

  it("clamps a finger past the ends to 1 and 5 stars", () => {
    expect(ratingAtX(-80, stars)).toBe(2);
    expect(ratingAtX(900, stars)).toBe(10);
  });

  it("has no rating without stars", () => {
    expect(ratingAtX(10, [])).toBeNull();
  });
});
