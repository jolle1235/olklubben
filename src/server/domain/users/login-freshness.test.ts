import { describe, expect, it } from "vitest";

import { isFreshLogin, SET_PASSWORD_FRESH_SECONDS } from "./login-freshness";

describe("isFreshLogin (D-152)", () => {
  const createdAt = new Date("2026-10-18T12:00:00.000Z");
  const after = (seconds: number) => new Date(createdAt.getTime() + seconds * 1000);

  it("is 10 minutes", () => {
    expect(SET_PASSWORD_FRESH_SECONDS).toBe(600);
  });

  it("is fresh right after the login and at 9:59", () => {
    expect(isFreshLogin(createdAt, createdAt)).toBe(true);
    expect(isFreshLogin(createdAt, after(1))).toBe(true);
    expect(isFreshLogin(createdAt, after(9 * 60 + 59))).toBe(true);
    expect(isFreshLogin(createdAt, new Date(after(600).getTime() - 1))).toBe(true);
  });

  it("is stale from exactly 10:00", () => {
    expect(isFreshLogin(createdAt, after(10 * 60))).toBe(false);
    expect(isFreshLogin(createdAt, after(11 * 60))).toBe(false);
    expect(isFreshLogin(createdAt, after(60 * 24 * 60 * 60))).toBe(false);
  });

  it("is never fresh for an invalid date", () => {
    expect(isFreshLogin(new Date(Number.NaN), createdAt)).toBe(false);
    expect(isFreshLogin(createdAt, new Date(Number.NaN))).toBe(false);
  });
});
