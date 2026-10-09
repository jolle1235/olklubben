import { describe, expect, it } from "vitest";

import {
  cleanUserName,
  FALLBACK_USER_NAME,
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
