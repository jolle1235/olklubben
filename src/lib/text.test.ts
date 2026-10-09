import { describe, expect, it } from "vitest";

import { cleanSingleLine, nameKey, stripNul } from "./text";

describe("stripNul", () => {
  it("removes every U+0000", () => {
    expect(stripNul("a\u0000b\u0000")).toBe("ab");
  });
});

describe("cleanSingleLine", () => {
  it("collapses every whitespace run to one space and trims", () => {
    expect(cleanSingleLine("  Hos \t Mads \n")).toBe("Hos Mads");
  });

  it("treats NBSP, ideographic space, line separators and BOM as whitespace", () => {
    expect(cleanSingleLine("\ufeffHos\u00a0\u00a0Mads\u3000og\u2028Bo\u2009")).toBe(
      "Hos Mads og Bo",
    );
  });

  it("normalizes to NFC, so a combining accent equals the precomposed letter", () => {
    expect(cleanSingleLine("Cafe\u0301")).toBe("Café");
    expect(cleanSingleLine("Cafe\u0301")).toHaveLength(4);
  });

  it("removes NUL characters", () => {
    expect(cleanSingleLine("Hos\u0000 Mads")).toBe("Hos Mads");
    expect(cleanSingleLine("\u0000")).toBe("");
  });

  it("keeps the case", () => {
    expect(cleanSingleLine("HOS mads")).toBe("HOS mads");
  });
});

describe("nameKey", () => {
  it("ignores case and all whitespace", () => {
    expect(nameKey("Hos Mads")).toBe("hosmads");
    expect(nameKey(" hos \u00a0MADS ")).toBe("hosmads");
    expect(nameKey("HosMads")).toBe("hosmads");
  });

  it("lower-cases Æ, Ø and Å the Danish way", () => {
    expect(nameKey("ÆRØ Å")).toBe("ærøå");
  });

  it("is the same for NFC and NFD input", () => {
    expect(nameKey("Café")).toBe(nameKey("Cafe\u0301"));
  });

  it("is empty for a name without visible characters", () => {
    expect(nameKey("  \u00a0\t\u0000")).toBe("");
  });
});
