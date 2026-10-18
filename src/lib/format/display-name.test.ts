import { describe, expect, it } from "vitest";

import {
  compareByDisplayName,
  FORMER_MEMBER_NAME,
  FORMER_USER_NAME,
  formatMemberName,
  getDisplayName,
  getFeedbackAuthorName,
  officialNameSuffix,
} from "./display-name";

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

describe("officialNameSuffix and formatMemberName (member list, profile)", () => {
  const jesper = { name: "Jesper Thomsen", nickname: "Kaptajnen" };

  it("shows the official name after a nickname", () => {
    expect(officialNameSuffix(jesper)).toBe("Jesper Thomsen");
    expect(formatMemberName(jesper)).toBe("Kaptajnen (Jesper Thomsen)");
  });

  it("shows only the name without a nickname", () => {
    expect(officialNameSuffix({ name: "Jesper Thomsen" })).toBeNull();
    expect(officialNameSuffix({ name: "Jesper Thomsen", nickname: "  " })).toBeNull();
    expect(formatMemberName({ name: "Jesper Thomsen", nickname: null })).toBe("Jesper Thomsen");
  });

  it("does not repeat a nickname that is only the name in other case or spacing", () => {
    expect(officialNameSuffix({ name: "Jesper Thomsen", nickname: "jesper  THOMSEN" })).toBeNull();
    expect(formatMemberName({ name: "Mads", nickname: "MADS" })).toBe("MADS");
  });

  it("shows 'Tidligere medlem' for a deleted account", () => {
    expect(officialNameSuffix(null)).toBeNull();
    expect(formatMemberName(null)).toBe(FORMER_MEMBER_NAME);
  });
});

describe("compareByDisplayName", () => {
  it("sorts by the shown name the Danish way (upper case first), then spelling, then id", () => {
    const users = [
      { id: "1", name: "Åge" },
      { id: "2", name: "Zacharias", nickname: "Bo" },
      { id: "4", name: "anders" },
      { id: "3", name: "Anders" },
      { id: "5", name: "Anders" },
      { id: "6", name: "Ærlig" },
    ];
    expect([...users].sort(compareByDisplayName).map((user) => user.id)).toEqual([
      "3",
      "5",
      "4",
      "2",
      "6",
      "1",
    ]);
  });
});

describe("getFeedbackAuthorName (SPEC §9.9, E27)", () => {
  it("shows the display name of the author", () => {
    expect(getFeedbackAuthorName({ name: "Jesper Thomsen", nickname: "Kaptajnen" })).toBe(
      "Kaptajnen",
    );
    expect(getFeedbackAuthorName({ name: " Mads ", nickname: null })).toBe("Mads");
  });

  it('shows "Tidligere bruger" (not "Tidligere medlem") for a deleted account', () => {
    expect(FORMER_USER_NAME).toBe("Tidligere bruger");
    expect(getFeedbackAuthorName(null)).toBe(FORMER_USER_NAME);
    expect(getFeedbackAuthorName(undefined)).toBe(FORMER_USER_NAME);
    expect(getFeedbackAuthorName({ name: "  ", nickname: "" })).toBe(FORMER_USER_NAME);
  });
});
