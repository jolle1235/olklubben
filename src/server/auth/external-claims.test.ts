import { describe, expect, it } from "vitest";

import { claimsFromIdToken } from "./external-claims";

function token(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

describe("claimsFromIdToken", () => {
  it("reads email (lowercase), email_verified and an allowed picture", () => {
    expect(
      claimsFromIdToken(
        token({
          email: " Jesper@Example.COM ",
          email_verified: true,
          picture: "https://lh3.googleusercontent.com/a/x",
        }),
      ),
    ).toEqual({
      email: "jesper@example.com",
      emailVerified: true,
      picture: "https://lh3.googleusercontent.com/a/x",
    });
  });

  it("treats anything but email_verified === true as unverified, and drops other pictures", () => {
    expect(
      claimsFromIdToken(
        token({
          email: "a@example.com",
          email_verified: "true",
          picture: "https://s.gravatar.com/avatar/x",
        }),
      ),
    ).toEqual({ email: "a@example.com", emailVerified: false, picture: null });
  });

  it("returns null for a missing or malformed token", () => {
    expect(claimsFromIdToken(null)).toBeNull();
    expect(claimsFromIdToken("not-a-jwt")).toBeNull();
    expect(claimsFromIdToken("a.%%%.c")).toBeNull();
  });
});
