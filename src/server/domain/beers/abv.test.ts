import { describe, expect, it } from "vitest";

import {
  ABV_ERROR_MESSAGES,
  ABV_INPUT_MAX_LENGTH,
  abvToInputValue,
  formatAbv,
  parseAbv,
  parseAbvInput,
} from "./abv";

describe("parseAbv (SPEC §9.5)", () => {
  it("accepts a comma or a dot", () => {
    expect(parseAbv("5,2")).toBe(5.2);
    expect(parseAbv("5.2")).toBe(5.2);
  });

  it("accepts spaces, a trailing % and whole numbers", () => {
    expect(parseAbv(" 5 ")).toBe(5);
    expect(parseAbv("5,2 %")).toBe(5.2);
    expect(parseAbv("5,2%")).toBe(5.2);
    expect(parseAbv("0")).toBe(0);
    expect(parseAbv("0,0")).toBe(0);
    expect(parseAbv("99,9")).toBe(99.9);
    expect(parseAbv("09,5")).toBe(9.5);
  });

  it("accepts trailing zeros after the one decimal", () => {
    expect(parseAbv("5,20")).toBe(5.2);
    expect(parseAbv("6,500")).toBe(6.5);
  });

  it("accepts numbers", () => {
    expect(parseAbv(5.2)).toBe(5.2);
    expect(parseAbv(0)).toBe(0);
  });

  it("refuses more than one decimal instead of rounding [BESLUTNING]", () => {
    expect(parseAbvInput("5,25")).toEqual({ ok: false, reason: "precision" });
    expect(parseAbvInput("4,95")).toEqual({ ok: false, reason: "precision" });
  });

  it("refuses values outside 0–99,9", () => {
    expect(parseAbvInput("100")).toEqual({ ok: false, reason: "range" });
    expect(parseAbvInput("99,95")).toEqual({ ok: false, reason: "precision" });
    expect(parseAbvInput("1234567890123456")).toEqual({ ok: false, reason: "range" });
  });

  it("refuses empty and malformed input", () => {
    expect(parseAbvInput("")).toEqual({ ok: false, reason: "empty" });
    expect(parseAbvInput("  ")).toEqual({ ok: false, reason: "empty" });
    expect(parseAbvInput(null)).toEqual({ ok: false, reason: "empty" });
    for (const value of ["-1", "5,", ",5", "5,2,1", "fem", "5 2", "1e2", "5.2.1"]) {
      expect(parseAbvInput(value), value).toEqual({ ok: false, reason: "format" });
    }
    expect(parseAbv(Number.NaN)).toBeNull();
  });

  it("keeps the documented examples working", () => {
    expect(parseAbv("5,2 %")).toBe(5.2);
    expect(parseAbv(" 5.2% ")).toBe(5.2);
    expect(parseAbv("5,20")).toBe(5.2);
    expect(parseAbv("99,9")).toBe(99.9);
    expect(parseAbvInput("5,25")).toEqual({ ok: false, reason: "precision" });
    expect(parseAbvInput("100")).toEqual({ ok: false, reason: "range" });
    expect(parseAbvInput("%")).toEqual({ ok: false, reason: "empty" });
    expect(parseAbvInput("")).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses input longer than the cap as a format error", () => {
    expect(parseAbvInput(" ".repeat(50) + "5,2" + " ".repeat(50))).toEqual({
      ok: true,
      value: 5.2,
    });
    expect(parseAbvInput("1".repeat(ABV_INPUT_MAX_LENGTH + 1))).toEqual({
      ok: false,
      reason: "format",
    });
    expect(parseAbvInput("123456789012345678901234567890")).toEqual({
      ok: false,
      reason: "format",
    });
  });

  // The field is parsed before the session check (§4.3): a huge payload must
  // not pin the event loop (a quadratic regex took minutes on ~1 MB).
  it.each([
    ["spaces before junk", "1" + " ".repeat(100_000) + "x"],
    ["trailing-zero decimals", "1," + "0".repeat(100_000) + "1"],
    ["spaces before %", "5" + " ".repeat(100_000) + "%"],
  ])("rejects a long payload (%s) quickly", (_label, payload) => {
    const started = performance.now();
    const result = parseAbvInput(payload);
    const elapsed = performance.now() - started;
    expect(result).toEqual({ ok: false, reason: "format" });
    expect(elapsed).toBeLessThan(50);
  });

  it("has a Danish message per reason", () => {
    expect(ABV_ERROR_MESSAGES.precision).toBe("Brug højst én decimal, fx 5,2.");
    expect(ABV_ERROR_MESSAGES.range).toBe("Alkoholprocenten skal være mellem 0 og 99,9.");
  });
});

describe("formatAbv", () => {
  it("formats as '5,2 %' with a non-breaking space", () => {
    expect(formatAbv(5.2)).toBe("5,2 %");
    expect(formatAbv(5)).toBe("5,0 %");
    expect(formatAbv(0)).toBe("0,0 %");
    expect(formatAbv(99.9)).toBe("99,9 %");
  });

  it("accepts Prisma's Decimal (or its string)", () => {
    expect(formatAbv("6.5")).toBe("6,5 %");
    expect(formatAbv({ toString: () => "9.5" })).toBe("9,5 %");
    expect(formatAbv("nope")).toBe("");
  });
});

describe("abvToInputValue", () => {
  it("gives the edit form's value with a comma", () => {
    expect(abvToInputValue(5.2)).toBe("5,2");
    expect(abvToInputValue(9)).toBe("9,0");
    expect(parseAbv(abvToInputValue(6.5))).toBe(6.5);
  });
});
