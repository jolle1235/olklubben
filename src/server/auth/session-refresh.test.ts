import { describe, expect, it } from "vitest";

import {
  isSessionRefreshDue,
  SESSION_REFRESH_SECONDS,
  SESSION_TTL_SECONDS,
} from "./session-refresh";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 8, 12, 0, 0);

describe("isSessionRefreshDue (D-030)", () => {
  it("uses a 60-day session that slides once a day", () => {
    expect(SESSION_TTL_SECONDS).toBe(5_184_000);
    expect(SESSION_REFRESH_SECONDS).toBe(86_400);
  });

  it("is not due for a fresh or recently refreshed session", () => {
    expect(isSessionRefreshDue(new Date(now + 60 * DAY), now)).toBe(false);
    expect(isSessionRefreshDue(new Date(now + 59 * DAY + 1), now)).toBe(false);
  });

  it("is due exactly one day after the last refresh, and later", () => {
    expect(isSessionRefreshDue(new Date(now + 59 * DAY), now)).toBe(true);
    expect(isSessionRefreshDue(new Date(now + 58 * DAY), now)).toBe(true);
    expect(isSessionRefreshDue(new Date(now + 1000), now)).toBe(true);
  });

  it("defaults to the current time", () => {
    expect(isSessionRefreshDue(new Date(Date.now() + 60 * DAY))).toBe(false);
    expect(isSessionRefreshDue(new Date(Date.now() + 58 * DAY))).toBe(true);
  });
});
