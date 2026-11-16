import { describe, expect, it } from "vitest";

import { externalLoginCard } from "./external-login-card";

const base = { configured: "auth0" as const, linkedParam: false };

describe("externalLoginCard (Profil, D-179)", () => {
  it("offers to connect only for a password account without any external login", () => {
    expect(externalLoginCard({ ...base, hasPassword: true, external: [] })).toBe("link");
  });

  it("hides the card for an account that already logs in externally", () => {
    for (const provider of ["auth0", "google"] as const) {
      for (const hasPassword of [true, false]) {
        expect(externalLoginCard({ ...base, hasPassword, external: [provider] })).toBe(null);
      }
    }
  });

  it("confirms a link that just happened, only when the account has the configured login", () => {
    expect(
      externalLoginCard({ ...base, hasPassword: true, external: ["auth0"], linkedParam: true }),
    ).toBe("linked");
    expect(
      externalLoginCard({ ...base, hasPassword: true, external: ["google"], linkedParam: true }),
    ).toBe(null);
  });

  it("has no card without a configured external login", () => {
    expect(externalLoginCard({ ...base, configured: null, hasPassword: true, external: [] })).toBe(
      null,
    );
  });
});
