import { describe, expect, it } from "vitest";

import { claimsFromIdToken, isAllowedAuth0Subject } from "./external-claims";

function token(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

describe("claimsFromIdToken", () => {
  it("reads email (lowercase), email_verified, an allowed picture and auth_time", () => {
    expect(
      claimsFromIdToken(
        token({
          email: " Jesper@Example.COM ",
          email_verified: true,
          picture: "https://lh3.googleusercontent.com/a/x",
          auth_time: 1_800_000_000,
        }),
      ),
    ).toEqual({
      email: "jesper@example.com",
      emailVerified: true,
      picture: "https://lh3.googleusercontent.com/a/x",
      authTime: new Date(1_800_000_000_000),
    });
  });

  it("treats anything but email_verified === true as unverified, and drops other pictures", () => {
    expect(
      claimsFromIdToken(
        token({
          email: "a@example.com",
          email_verified: "true",
          picture: "https://s.gravatar.com/avatar/x",
          auth_time: "1800000000",
        }),
      ),
    ).toEqual({ email: "a@example.com", emailVerified: false, picture: null, authTime: null });
  });

  it("returns null for a missing or malformed token", () => {
    expect(claimsFromIdToken(null)).toBeNull();
    expect(claimsFromIdToken("not-a-jwt")).toBeNull();
    expect(claimsFromIdToken("a.%%%.c")).toBeNull();
  });
});

describe("isAllowedAuth0Subject (D-166)", () => {
  it("allows only Google and Auth0's own database", () => {
    expect(isAllowedAuth0Subject("google-oauth2|1234")).toBe(true);
    expect(isAllowedAuth0Subject("auth0|abc")).toBe(true);
    for (const subject of [
      "samlp|corp|jesper",
      "waad|tenant|x",
      "oauth2|custom|x",
      "email|x",
      "auth0|",
      "google-oauth2",
      "",
      "xauth0|abc",
    ]) {
      expect(isAllowedAuth0Subject(subject), subject).toBe(false);
    }
  });
});
