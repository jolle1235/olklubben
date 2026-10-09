import { describe, expect, it } from "vitest";

import { homeDestinationPath, resolveHomeDestination } from "./routing";

describe("resolveHomeDestination (SPEC §10.1)", () => {
  it("sends a user without clubs to onboarding", () => {
    expect(resolveHomeDestination({ clubIds: [], lastActiveClubId: null })).toEqual({
      kind: "onboarding",
    });
    // A stale lastActiveClubId does not matter (E15).
    expect(resolveHomeDestination({ clubIds: [], lastActiveClubId: "gone" })).toEqual({
      kind: "onboarding",
    });
  });

  it("sends a user with one club straight to it, whatever lastActiveClubId says", () => {
    expect(resolveHomeDestination({ clubIds: ["a"], lastActiveClubId: null })).toEqual({
      kind: "club",
      clubId: "a",
    });
    expect(resolveHomeDestination({ clubIds: ["a"], lastActiveClubId: "old" })).toEqual({
      kind: "club",
      clubId: "a",
    });
  });

  it("sends a user with several clubs to the last active one", () => {
    expect(resolveHomeDestination({ clubIds: ["a", "b", "c"], lastActiveClubId: "b" })).toEqual({
      kind: "club",
      clubId: "b",
    });
  });

  it("shows the picker when the last active club is unset", () => {
    expect(resolveHomeDestination({ clubIds: ["a", "b"], lastActiveClubId: null })).toEqual({
      kind: "picker",
    });
  });

  it("ignores a last active club the user has left (E15)", () => {
    expect(resolveHomeDestination({ clubIds: ["a", "b"], lastActiveClubId: "x" })).toEqual({
      kind: "picker",
    });
  });

  it("treats duplicate ids as one club", () => {
    expect(resolveHomeDestination({ clubIds: ["a", "a"], lastActiveClubId: null })).toEqual({
      kind: "club",
      clubId: "a",
    });
  });
});

describe("homeDestinationPath", () => {
  it("maps each destination to its route (SPEC §8.2)", () => {
    expect(homeDestinationPath({ kind: "onboarding" })).toBe("/onboarding");
    expect(homeDestinationPath({ kind: "picker" })).toBe("/clubs");
    expect(homeDestinationPath({ kind: "club", clubId: "abc" })).toBe("/c/abc");
  });
});
