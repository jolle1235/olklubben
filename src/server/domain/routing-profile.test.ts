import { describe, expect, it } from "vitest";

import { resolveProfilePath } from "./routing";

const A = "0199a000-0000-7000-8000-00000000000a";
const B = "0199a000-0000-7000-8000-00000000000b";
const GONE = "0199a000-0000-7000-8000-0000000000ff";

describe("resolveProfilePath (D-023)", () => {
  it("sends a user without clubs to onboarding", () => {
    expect(resolveProfilePath({ clubIds: [], lastActiveClubId: null })).toBe("/onboarding");
  });

  it("ignores a last active club when the user has no clubs any more", () => {
    expect(resolveProfilePath({ clubIds: [], lastActiveClubId: GONE })).toBe("/onboarding");
  });

  it("uses the last active club when the user is still a member", () => {
    expect(resolveProfilePath({ clubIds: [A, B], lastActiveClubId: B })).toBe(`/c/${B}/profile`);
  });

  it("falls back to the first club when the last active club is gone (E15)", () => {
    expect(resolveProfilePath({ clubIds: [A, B], lastActiveClubId: GONE })).toBe(`/c/${A}/profile`);
  });

  it("falls back to the first club when no club was active yet", () => {
    expect(resolveProfilePath({ clubIds: [B, A], lastActiveClubId: null })).toBe(`/c/${B}/profile`);
  });

  it("uses the only club", () => {
    expect(resolveProfilePath({ clubIds: [A], lastActiveClubId: null })).toBe(`/c/${A}/profile`);
  });
});
