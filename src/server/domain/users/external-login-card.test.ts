import { describe, expect, it } from "vitest";

import { externalLoginCard } from "./external-login-card";

const base = { googleConfigured: true, linkedParam: false };

describe("externalLoginCard (Profil, D-179)", () => {
  it("offers to connect only for a password account without Google", () => {
    expect(externalLoginCard({ ...base, hasPassword: true, hasGoogle: false })).toBe("link");
  });

  it("hides the card for an account that already logs in with Google", () => {
    for (const hasPassword of [true, false]) {
      expect(externalLoginCard({ ...base, hasPassword, hasGoogle: true })).toBe(null);
    }
  });

  it("confirms a link that just happened, only when the account has Google", () => {
    expect(
      externalLoginCard({ ...base, hasPassword: true, hasGoogle: true, linkedParam: true }),
    ).toBe("linked");
    expect(
      externalLoginCard({ ...base, hasPassword: true, hasGoogle: false, linkedParam: true }),
    ).toBe("link");
  });

  it("has no card when Google is not configured", () => {
    expect(
      externalLoginCard({ ...base, googleConfigured: false, hasPassword: true, hasGoogle: false }),
    ).toBe(null);
  });
});
