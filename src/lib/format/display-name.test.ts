import { describe, expect, it } from "vitest";

import { FORMER_MEMBER_NAME, getDisplayName } from "./display-name";

describe("getDisplayName (SPEC §7.4, §9.8)", () => {
  it("uses the nickname when there is one", () => {
    expect(getDisplayName({ name: "Mads Jensen", nickname: "Bajer-Mads" })).toBe("Bajer-Mads");
  });

  it("falls back to the name without a nickname", () => {
    expect(getDisplayName({ name: "Mads Jensen" })).toBe("Mads Jensen");
    expect(getDisplayName({ name: "Mads Jensen", nickname: null })).toBe("Mads Jensen");
    expect(getDisplayName({ name: "Mads Jensen", nickname: "   " })).toBe("Mads Jensen");
  });

  it("trims", () => {
    expect(getDisplayName({ name: " Anders ", nickname: " Ande " })).toBe("Ande");
  });

  it('shows "Tidligere medlem" for a deleted account', () => {
    expect(getDisplayName(null)).toBe(FORMER_MEMBER_NAME);
    expect(getDisplayName(undefined)).toBe(FORMER_MEMBER_NAME);
    expect(FORMER_MEMBER_NAME).toBe("Tidligere medlem");
  });
});
