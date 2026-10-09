import { describe, expect, it } from "vitest";

import { getInitials, pickByName } from "./initials";

describe("getInitials", () => {
  it("uses the first and last word", () => {
    expect(getInitials("Jesper Holm Hansen")).toBe("JH");
  });

  it("handles a single name", () => {
    expect(getInitials("Mads")).toBe("M");
  });

  it("uppercases Danish letters", () => {
    expect(getInitials("øjvind ågård")).toBe("ØÅ");
  });

  it("skips words without letters", () => {
    expect(getInitials("Drengene & Bajere")).toBe("DB");
    expect(getInitials("  Øl  –  ")).toBe("Ø");
  });

  it("can return a single letter", () => {
    expect(getInitials("Drengene & Bajere", 1)).toBe("D");
  });

  it("falls back to a question mark", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
    expect(getInitials("&")).toBe("?");
  });
});

describe("pickByName", () => {
  const options = ["a", "b", "c"] as const;

  it("is deterministic", () => {
    expect(pickByName("Jesper", options)).toBe(pickByName("Jesper", options));
  });

  it("always returns one of the options", () => {
    for (const name of ["", "Mads", "Søren", "Ølklubben", "x".repeat(200)]) {
      expect(options).toContain(pickByName(name, options));
    }
  });
});
