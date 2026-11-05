import { describe, expect, it } from "vitest";

import { clubNameSize, longestWordLength } from "./club-name-size";

describe("longestWordLength", () => {
  it("measures the longest word", () => {
    expect(longestWordLength("Drengene & Bajere")).toBe(8);
    expect(longestWordLength("  Æblemostklubben  ")).toBe(15);
  });

  it("counts characters, not UTF-16 code units", () => {
    expect(longestWordLength("Øl🍺")).toBe(3);
  });

  it("is 0 for an empty name", () => {
    expect(longestWordLength("")).toBe(0);
  });
});

describe("clubNameSize", () => {
  it("keeps the largest size for names with short words, however long the name", () => {
    expect(clubNameSize("Drengene & Bajere")).toBe("text-body-lg-tight");
    expect(clubNameSize("Den Gamle Klub Fra Nørrebro Og Omegn")).toBe("text-body-lg-tight");
  });

  it("steps down for long single words", () => {
    expect(clubNameSize("Ølklubbensklub")).toBe("text-body-md-tight"); // 14
    expect(clubNameSize("Æblemostklubben")).toBe("text-body-md-tight"); // 15
    expect(clubNameSize("Torsdagsklubben")).toBe("text-body-md-tight"); // 15
    expect(clubNameSize("Ølsmagningsklubben")).toBe("text-label-lg-tight"); // 18
    expect(clubNameSize("Ølsmagningsklub")).toBe("text-body-md-tight"); // 15
  });

  it("uses the boundaries 13 and 15", () => {
    expect(clubNameSize("a".repeat(13))).toBe("text-body-lg-tight");
    expect(clubNameSize("a".repeat(14))).toBe("text-body-md-tight");
    expect(clubNameSize("a".repeat(15))).toBe("text-body-md-tight");
    expect(clubNameSize("a".repeat(16))).toBe("text-label-lg-tight");
  });
});
