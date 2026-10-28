import { afterAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";

import { signInCookie, signUpWithPassword } from "./helpers";

/**
 * Auth0 with a discovery document that has no jwks_uri (D-166, review L1/L2):
 * requireIdTokenVerification makes Better Auth skip the provider instead of
 * trusting unverified id tokens, and email/password keep working. Its own
 * file, because discovery runs once, when auth.ts is imported.
 */

const auth0 = vi.hoisted(() => {
  const DOMAIN = "olklubben-nojwks.eu.auth0.com";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === `https://${DOMAIN}/.well-known/openid-configuration`) {
      return Response.json({
        issuer: `https://${DOMAIN}/`,
        authorization_endpoint: `https://${DOMAIN}/authorize`,
        token_endpoint: `https://${DOMAIN}/oauth/token`,
        id_token_signing_alg_values_supported: ["RS256"],
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  return { DOMAIN, realFetch };
});

vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      AUTH0_DOMAIN: auth0.DOMAIN,
      AUTH0_CLIENT_ID: "itest-auth0-client",
      AUTH0_CLIENT_SECRET: "itest-auth0-secret",
    },
    externalProvider: "auth0",
    isRateLimitDisabled: true,
  };
});

const BASE = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");

afterAll(() => {
  globalThis.fetch = auth0.realFetch;
});

describe("Auth0 without a usable discovery document (D-166)", () => {
  it("is not registered, and email/password still work", async () => {
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ provider: "auth0", callbackURL: "/ok" }),
      }),
    );
    expect(response.ok).toBe(false);

    const user = await signUpWithPassword("Skaal-nojwks-12345");
    expect(await signInCookie(user.email, "Skaal-nojwks-12345")).not.toBeNull();
  });
});
