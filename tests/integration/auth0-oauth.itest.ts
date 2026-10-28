import { randomUUID } from "node:crypto";

import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { setPasswordAction } from "@/server/actions/profile";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { changeUserEmail } from "@/server/users/mutations";

import {
  createClub,
  expectRedirect,
  formData,
  setActor,
  signUpWithPassword,
  type TestUser,
} from "./helpers";

/**
 * Auth0 Universal Login (SPEC §6.2, D-166) through Better Auth's real HTTP
 * handler against Postgres. Only Auth0 is faked: fetch to the tenant's
 * discovery document, JWKS and token endpoint. The id tokens are really
 * signed (RS256) and verified by Better Auth against the JWKS (issuer,
 * audience, nonce), so a foreign key or a wrong nonce is refused for real.
 *
 * Discovery runs when auth.ts is imported, so the fetch stub is installed in
 * vi.hoisted, before any import.
 */

const auth0 = vi.hoisted(() => {
  const DOMAIN = "olklubben-itest.eu.auth0.com";
  const state = {
    jwks: { keys: [] as unknown[] },
    /** The token endpoint's next answer (set by each callback). */
    nextIdToken: null as string | null,
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === `https://${DOMAIN}/.well-known/openid-configuration`) {
      return Response.json({
        issuer: `https://${DOMAIN}/`,
        authorization_endpoint: `https://${DOMAIN}/authorize`,
        token_endpoint: `https://${DOMAIN}/oauth/token`,
        userinfo_endpoint: `https://${DOMAIN}/userinfo`,
        jwks_uri: `https://${DOMAIN}/.well-known/jwks.json`,
        end_session_endpoint: `https://${DOMAIN}/oidc/logout`,
        id_token_signing_alg_values_supported: ["RS256"],
      });
    }
    if (url === `https://${DOMAIN}/.well-known/jwks.json`) return Response.json(state.jwks);
    if (url === `https://${DOMAIN}/oauth/token`) {
      if (!state.nextIdToken) throw new Error("itest: intet Auth0-id-token sat");
      return Response.json({
        access_token: "itest-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid profile email",
        id_token: state.nextIdToken,
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  return { DOMAIN, state, realFetch };
});

vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      AUTH0_DOMAIN: auth0.DOMAIN,
      AUTH0_CLIENT_ID: "itest-auth0-client",
      AUTH0_CLIENT_SECRET: "itest-auth0-secret",
      // Also set, so "Google is not registered when Auth0 is" is really tested.
      GOOGLE_CLIENT_ID: "itest-google-client",
      GOOGLE_CLIENT_SECRET: "itest-google-secret",
    },
    externalProvider: "auth0",
    isRateLimitDisabled: true,
  };
});

const BASE = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
const PICTURE = "https://lh3.googleusercontent.com/a/itest-auth0";

let signingKey: CryptoKey;
let foreignKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const foreign = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  foreignKey = foreign.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "itest", alg: "RS256", use: "sig" };
  auth0.state.jwks = { keys: [jwk] };
});

afterAll(() => {
  globalThis.fetch = auth0.realFetch;
});

beforeEach(() => {
  auth0.state.nextIdToken = null;
  setActor(null);
});

type Identity = {
  sub: string;
  email: string;
  emailVerified?: boolean;
  /** Seconds since the epoch; defaults to now. */
  authTime?: number;
};

type IdTokenOptions = { nonce: string; key?: CryptoKey };

async function idToken(identity: Identity, { nonce, key }: IdTokenOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: identity.email,
    email_verified: identity.emailVerified ?? true,
    name: "Auth0 Bruger",
    picture: PICTURE,
    nonce,
    auth_time: identity.authTime ?? now,
  })
    .setProtectedHeader({ alg: "RS256", kid: "itest" })
    .setIssuer(`https://${auth0.DOMAIN}/`)
    .setAudience("itest-auth0-client")
    .setSubject(identity.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key ?? signingKey);
}

function cookiesFrom(headers: Headers): string[] {
  return headers.getSetCookie().map((value) => value.split(";")[0] ?? "");
}

type Started = { state: string; nonce: string; cookies: string[] };

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function start(
  path: "/sign-in/social" | "/link-social",
  sessionCookie?: string,
): Promise<Started> {
  const response = await post(
    path,
    { provider: "auth0", callbackURL: "/ok", errorCallbackURL: "/fejl" },
    sessionCookie,
  );
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  const authorize = new URL(url);
  expect(authorize.origin).toBe(`https://${auth0.DOMAIN}`);
  const state = authorize.searchParams.get("state");
  const nonce = authorize.searchParams.get("nonce");
  if (!state || !nonce) throw new Error("itest: ingen state/nonce i Auth0's URL");
  expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
  return { state, nonce, cookies: cookiesFrom(response.headers) };
}

async function callback(
  started: Started,
  identity: Identity,
  options: { nonce?: string; key?: CryptoKey } = {},
): Promise<Response> {
  auth0.state.nextIdToken = await idToken(identity, {
    nonce: options.nonce ?? started.nonce,
    key: options.key,
  });
  return auth.handler(
    new Request(`${BASE}/api/auth/callback/auth0?code=itest-code&state=${started.state}`, {
      headers: { cookie: started.cookies.join("; ") },
      redirect: "manual",
    }),
  );
}

function location(response: Response): string {
  return response.headers.get("location") ?? "";
}

function sessionCookie(response: Response): string | null {
  return (
    cookiesFrom(response.headers).find((c) => /^better-auth\.session_token=.+/.test(c)) ?? null
  );
}

async function auth0Accounts(userId: string) {
  return db.account.findMany({ where: { userId, providerId: "auth0" } });
}

function googleSub(): string {
  return `google-oauth2|${randomUUID()}`;
}

function newEmail(): string {
  return `itest-auth0-${randomUUID()}@example.test`;
}

async function passwordUser(): Promise<TestUser> {
  return signUpWithPassword("Skaal-auth0-12345", "Password Bruger", newEmail());
}

async function auth0User(identity: Identity): Promise<TestUser> {
  const response = await callback(await start("/sign-in/social"), identity);
  expect(location(response)).toBe("/ok");
  const cookie = sessionCookie(response);
  if (!cookie) throw new Error("itest: ingen session efter Auth0-login");
  const user = await db.user.findUniqueOrThrow({ where: { email: identity.email } });
  return { id: user.id, email: user.email, name: user.name, cookie };
}

describe("Fortsæt med Auth0 (§6.2, D-166)", () => {
  it("creates a new user with a verified email, Google's picture and a session", async () => {
    const email = newEmail();
    const response = await callback(await start("/sign-in/social"), { sub: googleSub(), email });

    expect(location(response)).toBe("/ok");
    expect(sessionCookie(response)).not.toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ emailVerified: true, image: PICTURE });
    expect(await auth0Accounts(user.id)).toHaveLength(1);
  });

  it("logs an existing Auth0 user in again without a duplicate", async () => {
    const identity = { sub: `auth0|${randomUUID()}`, email: newEmail() };
    await callback(await start("/sign-in/social"), identity);
    const response = await callback(await start("/sign-in/social"), identity);

    expect(location(response)).toBe("/ok");
    expect(await db.user.count({ where: { email: identity.email } })).toBe(1);
  });

  it("never links onto an existing password account with the same email (TG-002)", async () => {
    const victim = await passwordUser();
    const response = await callback(await start("/sign-in/social"), {
      sub: googleSub(),
      email: victim.email,
    });

    expect(location(response)).toMatch(/^\/fejl\?error=account_not_linked/);
    expect(sessionCookie(response)).toBeNull();
    expect(await auth0Accounts(victim.id)).toEqual([]);
  });

  it("refuses an Auth0 database user whose email is not verified, leaving nothing behind", async () => {
    const email = newEmail();
    const response = await callback(await start("/sign-in/social"), {
      sub: `auth0|${randomUUID()}`,
      email,
      emailVerified: false,
    });

    expect(location(response)).toMatch(/^\/fejl\?error=email_not_verified/);
    expect(sessionCookie(response)).toBeNull();
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });

  it("refuses connections other than Google and Auth0's database, leaving nothing behind", async () => {
    for (const sub of [`samlp|corp|${randomUUID()}`, `waad|${randomUUID()}`]) {
      const email = newEmail();
      const response = await callback(await start("/sign-in/social"), { sub, email });

      expect(location(response), sub).toMatch(/^\/fejl\?error=connection_not_allowed/);
      expect(sessionCookie(response)).toBeNull();
      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    }
  });

  it("refuses an id token signed with another key, and one with the wrong nonce", async () => {
    const forged = { sub: googleSub(), email: newEmail() };
    const foreign = await callback(await start("/sign-in/social"), forged, { key: foreignKey });
    expect(location(foreign)).toMatch(/error=/);
    expect(sessionCookie(foreign)).toBeNull();

    const wrongNonce = { sub: googleSub(), email: newEmail() };
    const replayed = await callback(await start("/sign-in/social"), wrongNonce, {
      nonce: "a-nonce-from-another-login",
    });
    expect(location(replayed)).toMatch(/error=/);
    expect(sessionCookie(replayed)).toBeNull();

    for (const { email } of [forged, wrongNonce]) {
      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    }
  });

  it("never overwrites the account's email from Auth0 on a later sign-in (D-151)", async () => {
    const identity = { sub: googleSub(), email: newEmail() };
    const user = await auth0User(identity);
    await db.user.update({ where: { id: user.id }, data: { name: "Eget navn" } });

    await callback(await start("/sign-in/social"), identity);
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      email: identity.email,
      name: "Eget navn",
    });
  });
});

describe("Forbind Auth0 på Profil (D-165, D-166)", () => {
  it("links Auth0 with the same verified email, adopts the picture and verifies the email", async () => {
    const user = await passwordUser();
    const response = await callback(await start("/link-social", user.cookie), {
      sub: googleSub(),
      email: user.email,
    });

    expect(location(response)).toBe("/ok");
    expect(await auth0Accounts(user.id)).toHaveLength(1);
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      image: PICTURE,
      emailVerified: true,
    });
  });

  it("refuses another email", async () => {
    const user = await passwordUser();
    const response = await callback(await start("/link-social", user.cookie), {
      sub: googleSub(),
      email: newEmail(),
    });

    expect(location(response)).toMatch(/^\/fejl\?error=email_does_not_match/);
    expect(await auth0Accounts(user.id)).toEqual([]);
  });

  it("refuses the link when the email changed while Auth0 was open (TG-064, race)", async () => {
    const user = await passwordUser();
    const started = await start("/link-social", user.cookie);
    await changeUserEmail(user.id, newEmail());

    const response = await callback(started, { sub: googleSub(), email: user.email });

    expect(location(response)).not.toBe("/ok");
    expect(await auth0Accounts(user.id)).toEqual([]);
  });

  it("drops Auth0 on an email change (TG-064)", async () => {
    const user = await passwordUser();
    await callback(await start("/link-social", user.cookie), {
      sub: googleSub(),
      email: user.email,
    });
    expect(await auth0Accounts(user.id)).toHaveLength(1);

    const { unlinkedExternal } = await changeUserEmail(user.id, newEmail());
    expect(unlinkedExternal).toBe(true);
    expect(await auth0Accounts(user.id)).toEqual([]);
  });
});

describe("external login only with the app's own parameters (D-166)", () => {
  it("refuses a client-supplied id token through auth.api", async () => {
    const email = newEmail();
    const token = await idToken({ sub: googleSub(), email }, { nonce: "n" });

    await expect(
      auth.api.signInSocial({ body: { provider: "auth0", idToken: { token } } }),
    ).rejects.toMatchObject({ body: { code: "ID_TOKEN_SIGN_IN_DISABLED" } });
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });

  it("refuses scopes and foreign additionalParams, but allows prompt=login", async () => {
    const base = { provider: "auth0", callbackURL: "/ok" };
    for (const extra of [
      { scopes: ["offline_access"] },
      { additionalParams: { connection: "samlp-corp" } },
    ]) {
      const response = await post("/sign-in/social", { ...base, ...extra });
      expect(response.status, JSON.stringify(extra)).toBe(400);
    }

    const reauth = await post("/sign-in/social", {
      ...base,
      additionalParams: { prompt: "login" },
    });
    expect(reauth.status).toBe(200);
    const { url } = (await reauth.json()) as { url: string };
    expect(new URL(url).searchParams.get("prompt")).toBe("login");
  });

  it("does not register the direct Google login when Auth0 is configured", async () => {
    const response = await post("/sign-in/social", { provider: "google", callbackURL: "/ok" });
    expect(response.ok).toBe(false);
  });
});

describe("Log ud also ends the Auth0 session (D-166)", () => {
  it("returns Auth0's logout URL with the id token hint and /login as the way back", async () => {
    const user = await auth0User({ sub: googleSub(), email: newEmail() });
    const response = await post("/sign-out", { disableRedirect: true }, user.cookie);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url?: string; redirect?: boolean };
    expect(body.redirect).toBe(false);
    const logout = new URL(body.url ?? "");
    expect(`${logout.origin}${logout.pathname}`).toBe(`https://${auth0.DOMAIN}/oidc/logout`);
    expect(logout.searchParams.get("post_logout_redirect_uri")).toBe(`${BASE}/login`);
    expect(logout.searchParams.get("client_id")).toBe("itest-auth0-client");
    expect(logout.searchParams.get("id_token_hint")).toBeTruthy();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("logs a password account out locally only", async () => {
    const user = await passwordUser();
    const response = await post("/sign-out", { disableRedirect: true }, user.cookie);
    expect(((await response.json()) as { url?: string }).url).toBeUndefined();
  });
});

describe("Tilføj password for an Auth0-only account (D-152, D-166)", () => {
  const NEW_PASSWORD = "Skaal-nyt-auth0-123";

  function passwordForm(clubId: string) {
    return formData({ clubId, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
  }

  it("refuses when the last real Auth0 login (auth_time) is older than 10 minutes", async () => {
    const elevenMinutesAgo = Math.floor(Date.now() / 1000) - 11 * 60;
    const user = await auth0User({
      sub: googleSub(),
      email: newEmail(),
      authTime: elevenMinutesAgo,
    });
    const clubId = await createClub(user);
    setActor(user);

    const result = await setPasswordAction(null, passwordForm(clubId));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.REAUTH_REQUIRED,
        message: "Log ind med Auth0 igen for at tilføje et password.",
      },
    });
    expect(await db.account.count({ where: { userId: user.id, providerId: "credential" } })).toBe(
      0,
    );
  });

  it("saves the password right after a real Auth0 login", async () => {
    const user = await auth0User({ sub: googleSub(), email: newEmail() });
    const clubId = await createClub(user);
    setActor(user);

    await expectRedirect(setPasswordAction(null, passwordForm(clubId)), /toast=password-set$/);
    expect(await db.account.count({ where: { userId: user.id, providerId: "credential" } })).toBe(
      1,
    );
  });
});
