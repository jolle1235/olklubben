import { describe, expect, it } from "vitest";

import { isInviteActive } from "./invites";

const now = new Date("2026-10-08T12:00:00Z");

describe("isInviteActive (SPEC §7.3, E18)", () => {
  it("is active when neither revoked nor expired", () => {
    expect(isInviteActive({ revokedAt: null, expiresAt: null }, now)).toBe(true);
  });

  it("is not active once revoked (a new code was generated)", () => {
    expect(
      isInviteActive({ revokedAt: new Date("2026-10-01T00:00:00Z"), expiresAt: null }, now),
    ).toBe(false);
  });

  it("honours an expiry date when one is set", () => {
    expect(
      isInviteActive({ revokedAt: null, expiresAt: new Date("2026-10-09T00:00:00Z") }, now),
    ).toBe(true);
    expect(isInviteActive({ revokedAt: null, expiresAt: now }, now)).toBe(false);
    expect(
      isInviteActive({ revokedAt: null, expiresAt: new Date("2026-10-07T00:00:00Z") }, now),
    ).toBe(false);
  });
});
