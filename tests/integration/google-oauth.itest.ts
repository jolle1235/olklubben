import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { changeUserEmail } from "@/server/users/mutations";

import { signUpWithPassword, type TestUser } from "./helpers";

/**
 * "Fortsæt med Google" and "Forbind Google" through Better Auth's real HTTP
 * handler against Postgres (SPEC §6.2, D-165, TG-002, TG-064, TG-011). Only
 * Google is faked: fetch to Google's token endpoint returns an id token with
 * the claims each test picks. The callback path decodes that token without a
 * signature check (it comes straight from Google over TLS), so an unsigned
 * token is enough here.
 */

vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      GOOGLE_CLIENT_ID: "itest-client-id",
      GOOGLE_CLIENT_SECRET: "itest-secret",
    },
    isGoogleConfigured: true,
    isRateLimitDisabled: true,
  };
});

const BASE = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PICTURE = "https://lh3.googleusercontent.com/a/itest-picture";

type GoogleIdentity = { sub: string; email: string; emailVerified?: boolean; picture?: string };

/** What Google's token endpoint answers next (set by each callback). */
let nextIdentity: GoogleIdentity | null = null;

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function idToken(identity: GoogleIdentity): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64url({ alg: "RS256", typ: "JWT", kid: "itest" }),
    base64url({
      iss: "https://accounts.google.com",
      aud: "itest-client-id",
      sub: identity.sub,
      email: identity.email,
      email_verified: identity.emailVerified ?? true,
      name: "Google Bruger",
      picture: identity.picture ?? PICTURE,
      iat: now,
      exp: now + 3600,
    }),
    "itest-signature",
  ].join(".");
}

const realFetch = globalThis.fetch;

beforeAll(() => {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(TOKEN_ENDPOINT)) {
      if (!nextIdentity) throw new Error("itest: ingen Google-identitet sat");
      return Response.json({
        access_token: "itest-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid email profile",
        id_token: idToken(nextIdentity),
      });
    }
    return realFetch(input, init);
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  nextIdentity = null;
});

// ── Flow helpers ────────────────────────────────────────────────────────────

/** "name=value" pairs from Set-Cookie headers, ready for a Cookie header. */
function cookiesFrom(headers: Headers): string[] {
  return headers.getSetCookie().map((value) => value.split(";")[0] ?? "");
}

type Started = { state: string; cookies: string[] };

/** POST /sign-in/social or /link-social; returns the OAuth state and its cookie. */
async function start(
  path: "/sign-in/social" | "/link-social",
  sessionCookie?: string,
): Promise<Started> {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE,
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      body: JSON.stringify({ provider: "google", callbackURL: "/ok", errorCallbackURL: "/fejl" }),
    }),
  );
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  if (!state) throw new Error("itest: ingen state i Googles URL");
  return { state, cookies: cookiesFrom(response.headers) };
}

/** Google sends the browser back: GET /callback/google?code&state. */
async function callback(started: Started, identity: GoogleIdentity): Promise<Response> {
  nextIdentity = identity;
  return auth.handler(
    new Request(`${BASE}/api/auth/callback/google?code=itest-code&state=${started.state}`, {
      headers: { cookie: started.cookies.join("; ") },
      redirect: "manual",
    }),
  );
}

function location(response: Response): string {
  return response.headers.get("location") ?? "";
}

function hasSessionCookie(response: Response): boolean {
  return cookiesFrom(response.headers).some((c) => /^better-auth\.session_token=.+/.test(c));
}

async function googleAccounts(userId: string) {
  return db.account.findMany({ where: { userId, providerId: "google" } });
}

function newSub(): string {
  return `google-sub-${randomUUID()}`;
}

function newEmail(): string {
  return `itest-google-${randomUUID()}@example.test`;
}

async function passwordUser(): Promise<TestUser> {
  return signUpWithPassword("Skaal-google-12345", "Password Bruger", newEmail());
}

// ── Sign-in ─────────────────────────────────────────────────────────────────

describe("Fortsæt med Google (§6.2)", () => {
  it("creates a new user with a verified email, Google's picture and a session", async () => {
    const email = newEmail();
    const response = await callback(await start("/sign-in/social"), { sub: newSub(), email });

    expect(location(response)).toBe("/ok");
    expect(hasSessionCookie(response)).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ emailVerified: true, image: PICTURE });
    expect(await googleAccounts(user.id)).toHaveLength(1);
  });

  it("logs an existing Google user in again without a duplicate", async () => {
    const identity = { sub: newSub(), email: newEmail() };
    await callback(await start("/sign-in/social"), identity);
    const response = await callback(await start("/sign-in/social"), identity);

    expect(location(response)).toBe("/ok");
    expect(await db.user.count({ where: { email: identity.email } })).toBe(1);
  });

  it("never links onto an existing password account with the same email (TG-002)", async () => {
    const victim = await passwordUser();
    const sessionsBefore = await db.session.count({ where: { userId: victim.id } });

    const response = await callback(await start("/sign-in/social"), {
      sub: newSub(),
      email: victim.email,
    });

    expect(location(response)).toMatch(/^\/fejl\?error=account_not_linked/);
    expect(hasSessionCookie(response)).toBe(false);
    expect(await googleAccounts(victim.id)).toEqual([]);
    expect(await db.session.count({ where: { userId: victim.id } })).toBe(sessionsBefore);
  });

  it("refuses a Google account whose email Google has not verified, leaving nothing behind", async () => {
    const email = newEmail();
    const response = await callback(await start("/sign-in/social"), {
      sub: newSub(),
      email,
      emailVerified: false,
    });

    expect(location(response)).toMatch(/^\/fejl\?error=email_not_verified/);
    expect(hasSessionCookie(response)).toBe(false);
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });

  it("refuses a wrong or reused state (CSRF)", async () => {
    const started = await start("/sign-in/social");
    const forged = await callback(
      { ...started, state: "forkert-state" },
      {
        sub: newSub(),
        email: newEmail(),
      },
    );
    expect(location(forged)).toMatch(/error=/);
    expect(hasSessionCookie(forged)).toBe(false);

    const email = newEmail();
    expect(location(await callback(started, { sub: newSub(), email }))).toBe("/ok");
    const replay = await callback(started, { sub: newSub(), email: newEmail() });
    expect(location(replay)).toMatch(/error=/);
    expect(hasSessionCookie(replay)).toBe(false);
  });
});

// ── Link ────────────────────────────────────────────────────────────────────

describe("Forbind Google på Profil (D-165)", () => {
  it("links Google with the same verified email, adopts the picture and verifies the email", async () => {
    const user = await passwordUser();
    const response = await callback(await start("/link-social", user.cookie), {
      sub: newSub(),
      email: user.email,
    });

    expect(location(response)).toBe("/ok");
    expect(await googleAccounts(user.id)).toHaveLength(1);
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      image: PICTURE,
      emailVerified: true,
    });

    // From now on "Fortsæt med Google" logs into this account.
    const signIn = await callback(await start("/sign-in/social"), {
      sub: (await googleAccounts(user.id))[0]?.accountId ?? "",
      email: user.email,
    });
    expect(location(signIn)).toBe("/ok");
    const cookie = cookiesFrom(signIn.headers).find((c) =>
      c.startsWith("better-auth.session_token="),
    );
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) });
    expect(session?.user.id).toBe(user.id);
  });

  it("refuses another email, an unverified email and a Google account linked elsewhere", async () => {
    const user = await passwordUser();

    const otherEmail = await callback(await start("/link-social", user.cookie), {
      sub: newSub(),
      email: newEmail(),
    });
    expect(location(otherEmail)).toMatch(/^\/fejl\?error=email_does_not_match/);

    const unverified = await callback(await start("/link-social", user.cookie), {
      sub: newSub(),
      email: user.email,
      emailVerified: false,
    });
    expect(location(unverified)).toMatch(/^\/fejl\?error=unable_to_link_account/);

    const taken = { sub: newSub(), email: newEmail() };
    await callback(await start("/sign-in/social"), taken);
    const elsewhere = await callback(await start("/link-social", user.cookie), {
      sub: taken.sub,
      email: user.email,
    });
    expect(location(elsewhere)).toMatch(/^\/fejl\?error=account_already_linked_to_different_user/);

    expect(await googleAccounts(user.id)).toEqual([]);
  });

  it("refuses the link when the email changed while Google was open (TG-064, race)", async () => {
    const user = await passwordUser();
    const oldEmail = user.email;
    const started = await start("/link-social", user.cookie);
    await changeUserEmail(user.id, newEmail());

    const response = await callback(started, { sub: newSub(), email: oldEmail });

    expect(response.status).not.toBe(302);
    expect(location(response)).not.toBe("/ok");
    expect(await googleAccounts(user.id)).toEqual([]);
  });

  it("drops Google on an email change, so the old Google account never reaches the account (TG-064)", async () => {
    const user = await passwordUser();
    const identity = { sub: newSub(), email: user.email };
    await callback(await start("/link-social", user.cookie), identity);
    expect(await googleAccounts(user.id)).toHaveLength(1);

    const { unlinkedGoogle } = await changeUserEmail(user.id, newEmail());
    expect(unlinkedGoogle).toBe(true);
    expect(await googleAccounts(user.id)).toEqual([]);

    // The old Google account now makes a separate user with the old address.
    const response = await callback(await start("/sign-in/social"), identity);
    expect(location(response)).toBe("/ok");
    const separate = await db.user.findUniqueOrThrow({ where: { email: identity.email } });
    expect(separate.id).not.toBe(user.id);
  });
});

// ── Closed endpoints ────────────────────────────────────────────────────────

describe("endpoints the app does not use are closed (D-165)", () => {
  it("answers 404 over HTTP", async () => {
    const user = await passwordUser();
    for (const path of [
      "/unlink-account",
      "/get-access-token",
      "/refresh-token",
      "/account-info",
      "/update-user",
    ]) {
      const response = await auth.handler(
        new Request(`${BASE}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE, cookie: user.cookie },
          body: JSON.stringify({ providerId: "credential", name: "Hacker", image: PICTURE }),
        }),
      );
      expect(response.status, path).toBe(404);
    }
  });

  it("refuses sign-in with a bare id token before even checking it", async () => {
    const email = newEmail();
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({
          provider: "google",
          idToken: { token: idToken({ sub: newSub(), email }) },
        }),
      }),
    );

    // Not a failed signature check (INVALID_TOKEN): the path is switched off.
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "ID_TOKEN_NOT_SUPPORTED" });
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });
});
