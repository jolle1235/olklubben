import { randomUUID } from "node:crypto";

import { isAPIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { changeEmailAction, setPasswordAction } from "@/server/actions/profile";
import { auth } from "@/server/auth/auth";
import { createPasswordResetUrl } from "@/server/auth/reset-link";
import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";

import {
  addGoogleAccount,
  createClub,
  createUser,
  expectNotFound,
  expectRedirect,
  formData,
  setActor,
  type TestUser,
} from "./helpers";

/**
 * "Skift email" (D-151) and "Tilføj password" (D-152) on Profil (SPEC §9.8)
 * against the real database and Better Auth: the current password, an email
 * in use or reserved for app-admin (APP_ADMIN_EMAILS, mocked below), the
 * lowercase unverified email, other sessions and reset links revoked while
 * this one stays, Google-only accounts, the 10-minute freshness of a Google
 * login, rate limits and 404s.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The integration env disables rate limiting (like E2E); two tests turn it on.
const envState = vi.hoisted(() => ({
  rateLimitDisabled: true,
  appAdminEmails: [] as string[],
}));
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    get isRateLimitDisabled() {
      return envState.rateLimitDisabled;
    },
    get appAdminEmails() {
      return envState.appAdminEmails;
    },
  };
});

const MALFORMED = "ikke-et-id";
const PASSWORD = "gammelt-password-1";
const NEW_PASSWORD = "nyt-password-123";
/** A reserved app-admin address that no account has. */
const ADMIN_EMAIL = `app-admin-${randomUUID()}@example.test`;

beforeEach(() => {
  setActor(null);
  envState.rateLimitDisabled = true;
  envState.appAdminEmails = [ADMIN_EMAIL];
});

function sessionCookie(headers: Headers): string {
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0] ?? "")
    .find((value) => value.startsWith("better-auth.session_token="));
  if (!cookie) throw new Error("Ingen session-cookie.");
  return cookie;
}

/** A user with a password we know (the helpers' createUser keeps its password private). */
async function signUp(name = "Konto Bruger"): Promise<TestUser> {
  const email = `account-${randomUUID()}@example.test`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { name, email, password: PASSWORD },
    returnHeaders: true,
  });
  return { id: response.user.id, email, name, cookie: sessionCookie(headers) };
}

/**
 * A Google-only account (D-152): Google login, no password. Its one session
 * was created just now, like right after a Google login.
 */
async function googleOnlyUser(): Promise<TestUser> {
  const user = await signUp("Google Bruger");
  await addGoogleAccount(user);
  await db.account.deleteMany({ where: { userId: user.id, providerId: "credential" } });
  return user;
}

/** Logs in again (another device): a new session cookie, or null when refused. */
async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    return sessionCookie(headers);
  } catch (error) {
    if (isAPIError(error)) return null;
    throw error;
  }
}

async function sessionUser(cookie: string) {
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  return session?.user ?? null;
}

async function storedUser(user: TestUser) {
  return db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, emailVerified: true },
  });
}

async function providers(user: TestUser): Promise<string[]> {
  const accounts = await db.account.findMany({
    where: { userId: user.id },
    select: { providerId: true },
    orderBy: { providerId: "asc" },
  });
  return accounts.map((account) => account.providerId);
}

/** Another device's session, written directly (a Google-only account cannot sign in by email). */
async function addOtherSession(user: TestUser): Promise<string> {
  const session = await db.session.create({
    data: {
      userId: user.id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  return session.id;
}

/** "  Mads@Example.test " for mads@example.test: how a person might type an email. */
function typedLoosely(email: string): string {
  return `  ${email.charAt(0).toUpperCase()}${email.slice(1).replace("example", "Example")} `;
}

describe("changeEmailAction (D-151)", () => {
  function emailForm(clubId: string, newEmail: string, currentPassword = PASSWORD) {
    return formData({ clubId, newEmail, confirmEmail: newEmail, currentPassword });
  }

  it("et forkert nuværende password giver en fejl på feltet; emailen er uændret", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);
    const newEmail = `ny-${randomUUID()}@example.test`;

    const result = await changeEmailAction(null, emailForm(clubId, newEmail, "forkert-password"));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_PASSWORD",
        message: AUTH_ERROR_MESSAGES.currentPasswordWrong,
        fieldErrors: { currentPassword: [AUTH_ERROR_MESSAGES.currentPasswordWrong] },
      },
      // The emails come back; the password never does.
      values: { newEmail, confirmEmail: newEmail },
    });
    expect((await storedUser(user)).email).toBe(user.email);
  });

  it("validerer i formularen: forskellige emails og manglende password, og ekkoer kun emails", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);

    const result = await changeEmailAction(
      null,
      formData({
        clubId,
        newEmail: "ny@example.test",
        confirmEmail: "nu@example.test",
        currentPassword: "",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.VALIDATION,
        message: expect.any(String),
        fieldErrors: {
          confirmEmail: ["De to emails er ikke ens."],
          currentPassword: ["Skriv dit nuværende password."],
        },
      },
      values: { newEmail: "ny@example.test", confirmEmail: "nu@example.test" },
    });
    expect((await storedUser(user)).email).toBe(user.email);
  });

  it("en email, en anden konto har (skrevet med store bogstaver og mellemrum), afvises på feltet", async () => {
    const user = await signUp();
    const other = await signUp("Mads");
    const clubId = await createClub(user);
    setActor(user);

    const result = await changeEmailAction(null, emailForm(clubId, typedLoosely(other.email)));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.EMAIL_IN_USE,
        fieldErrors: { newEmail: ["Den email bruges allerede af en anden konto."] },
      },
    });
    expect((await storedUser(user)).email).toBe(user.email);
    expect((await storedUser(other)).email).toBe(other.email);
    expect(await sessionUser(user.cookie)).toMatchObject({ email: user.email });
  });

  it("ens egen email giver 'Det er allerede din email.'", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);

    const result = await changeEmailAction(null, emailForm(clubId, typedLoosely(user.email)));

    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { newEmail: ["Det er allerede din email."] } },
    });
  });

  it("en adresse i APP_ADMIN_EMAILS får præcis samme svar som en email i brug (D-142)", async () => {
    const user = await signUp();
    const other = await signUp("Mads");
    const clubId = await createClub(user);
    setActor(user);

    const reserved = await changeEmailAction(null, emailForm(clubId, ADMIN_EMAIL.toUpperCase()));
    const taken = await changeEmailAction(null, emailForm(clubId, other.email));

    expect(reserved).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.EMAIL_IN_USE,
        fieldErrors: { newEmail: ["Den email bruges allerede af en anden konto."] },
      },
    });
    // Nothing tells the two apart, so the list cannot be probed.
    expect(reserved?.ok === false && reserved.error).toEqual(taken?.ok === false && taken.error);
    expect((await storedUser(user)).email).toBe(user.email);
    expect(await db.user.count({ where: { email: ADMIN_EMAIL } })).toBe(0);
  });

  it("skifter emailen (lowercase, uverificeret), logger andre enheder og links ud og beholder denne session", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    const otherDevice = await signIn(user.email, PASSWORD);
    if (!otherDevice) throw new Error("kunne ikke logge ind igen");
    await createPasswordResetUrl(user.id);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(2);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(1);
    setActor(user);
    const newEmail = `ny-${randomUUID()}@example.test`;

    await expectRedirect(
      changeEmailAction(null, emailForm(clubId, typedLoosely(newEmail))),
      new RegExp(`^/c/${clubId}/profile\\?toast=email-changed$`),
    );

    expect(await storedUser(user)).toEqual({ email: newEmail, emailVerified: false });
    expect(await sessionUser(user.cookie)).toMatchObject({ id: user.id, email: newEmail });
    expect(await sessionUser(otherDevice)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(0);
    // The new email logs in; the old one is gone.
    expect(await signIn(newEmail, PASSWORD)).not.toBeNull();
    expect(await signIn(user.email, PASSWORD)).toBeNull();
  });

  it("en konto med password og Google beholder sit Google-login", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    await addGoogleAccount(user);
    setActor(user);
    const newEmail = `ny-${randomUUID()}@example.test`;

    await expectRedirect(
      changeEmailAction(null, emailForm(clubId, newEmail)),
      /toast=email-changed$/,
    );

    expect((await storedUser(user)).email).toBe(newEmail);
    expect(await providers(user)).toEqual(["credential", "google"]);
  });

  it("en ren Google-konto får en forklaring, og intet ændres", async () => {
    const user = await googleOnlyUser();
    const clubId = await createClub(user);
    setActor(user);

    const result = await changeEmailAction(
      null,
      emailForm(clubId, `ny-${randomUUID()}@example.test`),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: AUTH_ERROR_MESSAGES.emailFollowsGoogle,
      },
    });
    expect((await storedUser(user)).email).toBe(user.email);
  });

  it("404 for en fremmed klub og et forkert id; logget ud → login", async () => {
    const user = await signUp();
    const stranger = await createUser("Fremmed");
    const otherClubId = await createClub(stranger);
    const newEmail = `ny-${randomUUID()}@example.test`;

    await expectRedirect(changeEmailAction(null, emailForm(otherClubId, newEmail)), /^\/login$/);

    setActor(user);
    await expectNotFound(changeEmailAction(null, emailForm(otherClubId, newEmail)));
    await expectNotFound(changeEmailAction(null, emailForm(MALFORMED, newEmail)));
    expect((await storedUser(user)).email).toBe(user.email);
  });

  it("det 11. forsøg inden for 15 minutter bliver afvist (rate limit pr. bruger)", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);
    envState.rateLimitDisabled = false;
    const newEmail = `ny-${randomUUID()}@example.test`;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const result = await changeEmailAction(null, emailForm(clubId, newEmail, "forkert-password"));
      expect(result).toMatchObject({ error: { code: "INVALID_PASSWORD" } });
    }
    const limited = await changeEmailAction(null, emailForm(clubId, newEmail));

    expect(limited).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.RATE_LIMITED },
      values: { newEmail, confirmEmail: newEmail },
    });
    // The right password was never tried.
    expect((await storedUser(user)).email).toBe(user.email);
  });
});

describe("setPasswordAction (D-152)", () => {
  function passwordForm(clubId: string, newPassword = NEW_PASSWORD, confirmPassword = newPassword) {
    return formData({ clubId, newPassword, confirmPassword });
  }

  it("en frisk Google-konto får et password; andre enheder og links logges ud, denne session bliver", async () => {
    const user = await googleOnlyUser();
    const clubId = await createClub(user);
    const otherSessionId = await addOtherSession(user);
    await createPasswordResetUrl(user.id);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(1);
    setActor(user);

    await expectRedirect(
      setPasswordAction(null, passwordForm(clubId)),
      new RegExp(`^/c/${clubId}/profile\\?toast=password-set$`),
    );

    expect(await providers(user)).toEqual(["credential", "google"]);
    expect(await sessionUser(user.cookie)).toMatchObject({ id: user.id });
    expect(await db.session.findUnique({ where: { id: otherSessionId } })).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(0);
    expect(await signIn(user.email, NEW_PASSWORD)).not.toBeNull();
  });

  it("et Google-login ældre end 10 minutter giver REAUTH_REQUIRED, og intet password gemmes", async () => {
    const user = await googleOnlyUser();
    const clubId = await createClub(user);
    await db.session.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
    setActor(user);

    expect(await setPasswordAction(null, passwordForm(clubId))).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.REAUTH_REQUIRED,
        message: "Log ind med Google igen for at tilføje et password.",
      },
      values: {},
    });
    expect(await providers(user)).toEqual(["google"]);
    expect(await signIn(user.email, NEW_PASSWORD)).toBeNull();
  });

  it("en konto, der allerede har et password, bliver afvist", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    await addGoogleAccount(user);
    setActor(user);

    expect(await setPasswordAction(null, passwordForm(clubId))).toEqual({
      ok: false,
      error: { code: "PASSWORD_ALREADY_SET", message: AUTH_ERROR_MESSAGES.passwordAlreadySet },
      values: {},
    });
    expect(await signIn(user.email, PASSWORD)).not.toBeNull();
    expect(await signIn(user.email, NEW_PASSWORD)).toBeNull();
  });

  it("forskellige eller for korte passwords giver fejl på felterne, og intet skrives", async () => {
    const user = await googleOnlyUser();
    const clubId = await createClub(user);
    setActor(user);

    expect(
      await setPasswordAction(null, passwordForm(clubId, NEW_PASSWORD, "noget-andet-123")),
    ).toMatchObject({
      ok: false,
      error: { fieldErrors: { confirmPassword: ["De to passwords er ikke ens."] } },
      values: {},
    });
    expect(await setPasswordAction(null, passwordForm(clubId, "kort"))).toMatchObject({
      ok: false,
      error: { fieldErrors: { newPassword: ["Password skal være mindst 8 tegn."] } },
      values: {},
    });
    expect(await providers(user)).toEqual(["google"]);
  });

  it("en konto uden både Google og password bliver afvist", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    await db.account.deleteMany({ where: { userId: user.id } });
    setActor(user);

    expect(await setPasswordAction(null, passwordForm(clubId))).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.UNEXPECTED },
    });
    expect(await providers(user)).toEqual([]);
  });

  it("404 for en fremmed klub og et forkert id; logget ud → login", async () => {
    const user = await googleOnlyUser();
    const stranger = await createUser("Fremmed");
    const otherClubId = await createClub(stranger);

    await expectRedirect(setPasswordAction(null, passwordForm(otherClubId)), /^\/login$/);

    setActor(user);
    await expectNotFound(setPasswordAction(null, passwordForm(otherClubId)));
    await expectNotFound(setPasswordAction(null, passwordForm(MALFORMED)));
    expect(await providers(user)).toEqual(["google"]);
  });

  it("bliver afvist, når grænsen på 10 pr. 15 minutter er nået (rate limit pr. bruger)", async () => {
    const user = await googleOnlyUser();
    const clubId = await createClub(user);
    setActor(user);
    envState.rateLimitDisabled = false;
    // Ten earlier attempts in this window (a success would end the form, so count them directly).
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await rateLimit(`password:set:user:${user.id}`, { limit: 10, windowSeconds: 15 * 60 });
    }

    expect(await setPasswordAction(null, passwordForm(clubId))).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.RATE_LIMITED },
      values: {},
    });
    expect(await providers(user)).toEqual(["google"]);
  });
});
