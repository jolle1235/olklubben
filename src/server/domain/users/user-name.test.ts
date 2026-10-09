import { describe, expect, it } from "vitest";

import {
  cleanNickname,
  cleanUserName,
  FALLBACK_USER_NAME,
  NICKNAME_MAX_LENGTH,
  resolveNewUserName,
  USER_NAME_MAX_LENGTH,
} from "./user-name";

describe("cleanUserName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanUserName("  Jesper   Hansen \n")).toBe("Jesper Hansen");
  });

  it("cuts to 100 characters without splitting an emoji", () => {
    const long = "🍺".repeat(150);
    const cleaned = cleanUserName(long);
    expect(Array.from(cleaned)).toHaveLength(USER_NAME_MAX_LENGTH);
    expect(cleaned).toBe("🍺".repeat(100));
  });

  it("removes NUL characters (TG-029)", () => {
    expect(cleanUserName("Jes\u0000per")).toBe("Jesper");
    expect(cleanUserName("\u0000 \u0000")).toBe("");
  });

  it("returns an empty string for blank or non-string input", () => {
    expect(cleanUserName("   ")).toBe("");
    expect(cleanUserName(undefined)).toBe("");
    expect(cleanUserName(42)).toBe("");
  });
});

describe("resolveNewUserName", () => {
  it("prefers the given name", () => {
    expect(resolveNewUserName(" Mads ", "mads@example.com")).toBe("Mads");
  });

  it("falls back to the email's local part", () => {
    expect(resolveNewUserName("", "anders.b@example.com")).toBe("anders.b");
    expect(resolveNewUserName(undefined, "anders@example.com")).toBe("anders");
  });

  it("falls back to a friendly default when nothing is usable", () => {
    expect(resolveNewUserName("  ", "@example.com")).toBe(FALLBACK_USER_NAME);
    expect(resolveNewUserName(null, null)).toBe(FALLBACK_USER_NAME);
  });
});

describe("cleanNickname (D-105)", () => {
  it("trims, collapses whitespace and normalizes to NFC", () => {
    expect(cleanNickname("  Kaptaj\u00a0 nen \n")).toBe("Kaptaj nen");
    expect(cleanNickname("Cafe\u0301")).toBe("Café");
  });

  it("removes NUL characters", () => {
    expect(cleanNickname("Kap\u0000tajnen")).toBe("Kaptajnen");
  });

  it("returns null for blank, NUL-only or non-string input (clears the nickname)", () => {
    expect(cleanNickname("")).toBeNull();
    expect(cleanNickname("   ")).toBeNull();
    expect(cleanNickname("\u0000")).toBeNull();
    expect(cleanNickname(null)).toBeNull();
    expect(cleanNickname(42)).toBeNull();
  });

  it("cuts to 40 characters without splitting an emoji", () => {
    expect(NICKNAME_MAX_LENGTH).toBe(40);
    expect(cleanNickname("🍺".repeat(50))).toBe("🍺".repeat(40));
    expect(cleanNickname(`${"a".repeat(39)} b`)).toBe("a".repeat(39));
  });
});
