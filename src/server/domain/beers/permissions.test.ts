import { describe, expect, it } from "vitest";

import { canAddBeer, canDeleteBeer, canEditBeer, canRateBeer } from "./permissions";

const CREATOR = "0199a000-0000-7000-8000-0000000000a1";
const OTHER = "0199a000-0000-7000-8000-0000000000a2";
const beer = { createdById: CREATOR };

describe("beer permissions (SPEC §5.1, D-063)", () => {
  it("every member may add and rate beers, a non-member may not", () => {
    for (const can of [canAddBeer, canRateBeer]) {
      expect(can({ role: "MEMBER" })).toBe(true);
      expect(can({ role: "ADMIN" })).toBe(true);
      expect(can(null)).toBe(false);
    }
  });

  for (const [name, can] of [
    ["canEditBeer", canEditBeer],
    ["canDeleteBeer", canDeleteBeer],
  ] as const) {
    describe(name, () => {
      it("allows the creator and admins", () => {
        expect(can({ role: "MEMBER" }, beer, CREATOR)).toBe(true);
        expect(can({ role: "ADMIN" }, beer, OTHER)).toBe(true);
      });

      it("refuses other members and non-members", () => {
        expect(can({ role: "MEMBER" }, beer, OTHER)).toBe(false);
        expect(can(null, beer, CREATOR)).toBe(false);
      });
    });
  }
});
