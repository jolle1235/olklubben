import { describe, expect, it } from "vitest";

import { isAppAdmin } from "./app-admin";

const ADMINS = ["jesper@example.com", "mads@example.com"];

describe("isAppAdmin (SPEC §9.9, D-142)", () => {
  it("matches an email on the list", () => {
    expect(isAppAdmin("jesper@example.com", ADMINS)).toBe(true);
    expect(isAppAdmin("mads@example.com", ADMINS)).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isAppAdmin("  Jesper@Example.COM ", ADMINS)).toBe(true);
    expect(isAppAdmin("jesper@example.com", [" JESPER@example.com "])).toBe(true);
  });

  it("is an exact match, never a substring", () => {
    expect(isAppAdmin("xjesper@example.com", ADMINS)).toBe(false);
    expect(isAppAdmin("jesper@example.com.evil", ADMINS)).toBe(false);
    expect(isAppAdmin("jesper", ADMINS)).toBe(false);
  });

  it("is false without an email or without admins", () => {
    expect(isAppAdmin(null, ADMINS)).toBe(false);
    expect(isAppAdmin(undefined, ADMINS)).toBe(false);
    expect(isAppAdmin("", ADMINS)).toBe(false);
    expect(isAppAdmin("   ", ADMINS)).toBe(false);
    expect(isAppAdmin("jesper@example.com", [])).toBe(false);
    expect(isAppAdmin("", [""])).toBe(false);
  });
});
