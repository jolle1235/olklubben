import { randomUUID } from "node:crypto";

import { isAPIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { changePasswordAction, updateProfileAction } from "@/server/actions/profile";
import { auth } from "@/server/auth/auth";
import { createPasswordResetUrl } from "@/server/auth/reset-link";
import { db } from "@/server/db";

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
 * Agent A's Profil actions (SPEC §9.8, D-105, D-106) against the real
 * database and Better Auth: the nickname (set, cleared, cleaned, too long),
 * and "Skift password" (wrong current password, this session kept, the
 * others and every reset link revoked, Google-only accounts, rate limit).
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The integration env disables rate limiting (like E2E); one test turns it on.
const rateLimits = vi.hoisted(() => ({ disabled: true }));
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    get isRateLimitDisabled() {
      return rateLimits.disabled;
    },
  };
});

const MALFORMED = "ikke-et-id";
const PASSWORD = "gammelt-password-1";
const NEW_PASSWORD = "nyt-password-123";

beforeEach(() => {
  setActor(null);
  rateLimits.disabled = true;
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
async function signUp(name = "Profil Bruger"): Promise<TestUser> {
  const email = `r3profile-${randomUUID()}@example.test`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { name, email, password: PASSWORD },
    returnHeaders: true,
  });
  return { id: response.user.id, email, name, cookie: sessionCookie(headers) };
}

/** Logs in again (another device): a new session cookie, or null when the password is wrong. */
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

async function storedProfile(user: TestUser) {
  return db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, nickname: true },
  });
}

describe("updateProfileAction", () => {
  it("gemmer navn og kælenavn renset, og sessionen viser kælenavnet (D-105)", async () => {
    const user = await createUser("Jesper");
    const clubId = await createClub(user);
    setActor(user);

    await expectRedirect(
      updateProfileAction(
        null,
        formData({ clubId, name: "  Jesper   Thomsen ", nickname: "  Kap\u0000tajnen  " }),
      ),
      new RegExp(`^/c/${clubId}/profile\\?toast=profile-updated$`),
    );
    expect(await storedProfile(user)).toEqual({ name: "Jesper Thomsen", nickname: "Kaptajnen" });
    expect(await sessionUser(user.cookie)).toMatchObject({
      name: "Jesper Thomsen",
      nickname: "Kaptajnen",
    });

    // An empty nickname clears it.
    await expectRedirect(
      updateProfileAction(null, formData({ clubId, name: "Jesper Thomsen", nickname: "   " })),
      /toast=profile-updated$/,
    );
    expect(await storedProfile(user)).toEqual({ name: "Jesper Thomsen", nickname: null });
  });

  it("afviser et 41 tegns kælenavn og et tomt navn og sender det skrevne tilbage", async () => {
    const user = await createUser("Jesper");
    const clubId = await createClub(user);
    setActor(user);
    const values = { name: "   ", nickname: "k".repeat(41) };

    const result = await updateProfileAction(null, formData({ clubId, ...values }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.VALIDATION,
        fieldErrors: {
          name: ["Skriv dit navn."],
          nickname: ["Kælenavnet må højst være 40 tegn."],
        },
      },
      values,
    });
    expect(await storedProfile(user)).toEqual({ name: "Jesper", nickname: null });

    // 40 characters (also emoji, counted as one each) is fine.
    await expectRedirect(
      updateProfileAction(null, formData({ clubId, name: "Jesper", nickname: "🍺".repeat(40) })),
      /toast=profile-updated$/,
    );
    expect((await storedProfile(user)).nickname).toBe("🍺".repeat(40));
  });

  it("404 for en klub, man ikke er med i, og et forkert id; logget ud → login", async () => {
    const user = await createUser("Jesper");
    const stranger = await createUser("Fremmed");
    const otherClubId = await createClub(stranger);

    await expectRedirect(
      updateProfileAction(null, formData({ clubId: otherClubId, name: "X" })),
      /^\/login$/,
    );

    setActor(user);
    await expectNotFound(updateProfileAction(null, formData({ clubId: otherClubId, name: "X" })));
    await expectNotFound(updateProfileAction(null, formData({ clubId: MALFORMED, name: "X" })));
    expect(await storedProfile(user)).toEqual({ name: "Jesper", nickname: null });
  });
});

describe("changePasswordAction", () => {
  function passwordForm(clubId: string, currentPassword: string, newPassword = NEW_PASSWORD) {
    return formData({ clubId, currentPassword, newPassword, confirmPassword: newPassword });
  }

  it("et forkert nuværende password giver en fejl på feltet og ekkoer intet", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);

    const result = await changePasswordAction(null, passwordForm(clubId, "forkert-password"));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_PASSWORD",
        message: AUTH_ERROR_MESSAGES.currentPasswordWrong,
        fieldErrors: { currentPassword: [AUTH_ERROR_MESSAGES.currentPasswordWrong] },
      },
      values: {},
    });
    expect(await signIn(user.email, PASSWORD)).not.toBeNull();
  });

  it("validerer i formularen: forskellige nye passwords og det samme som før", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);

    const mismatch = await changePasswordAction(
      null,
      formData({
        clubId,
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: "noget-andet-123",
      }),
    );
    expect(mismatch).toMatchObject({
      ok: false,
      error: { fieldErrors: { confirmPassword: ["De to passwords er ikke ens."] } },
      values: {},
    });

    const same = await changePasswordAction(null, passwordForm(clubId, PASSWORD, PASSWORD));
    expect(same).toMatchObject({
      ok: false,
      error: {
        fieldErrors: {
          newPassword: ["Vælg et nyt password, der er forskelligt fra det nuværende."],
        },
      },
    });
  });

  it("skifter password, beholder denne session og logger de andre enheder og links ud (D-106)", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    const otherDevice = await signIn(user.email, PASSWORD);
    if (!otherDevice) throw new Error("kunne ikke logge ind igen");
    await createPasswordResetUrl(user.id);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(1);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(2);
    setActor(user);

    await expectRedirect(
      changePasswordAction(null, passwordForm(clubId, PASSWORD)),
      new RegExp(`^/c/${clubId}/profile\\?toast=password-changed$`),
    );

    expect(await sessionUser(user.cookie)).toMatchObject({ id: user.id });
    expect(await sessionUser(otherDevice)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(0);
    expect(await signIn(user.email, PASSWORD)).toBeNull();
    expect(await signIn(user.email, NEW_PASSWORD)).not.toBeNull();
  });

  it("en konto uden password (kun Google) får en forklaring", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    await addGoogleAccount(user);
    await db.account.deleteMany({ where: { userId: user.id, providerId: "credential" } });
    setActor(user);

    expect(await changePasswordAction(null, passwordForm(clubId, PASSWORD))).toEqual({
      ok: false,
      error: { code: "CREDENTIAL_ACCOUNT_NOT_FOUND", message: AUTH_ERROR_MESSAGES.noPasswordLogin },
      values: {},
    });
  });

  it("404 for en fremmed klub og et forkert id", async () => {
    const user = await signUp();
    const stranger = await createUser("Fremmed");
    const otherClubId = await createClub(stranger);
    setActor(user);

    await expectNotFound(changePasswordAction(null, passwordForm(otherClubId, PASSWORD)));
    await expectNotFound(changePasswordAction(null, passwordForm(MALFORMED, PASSWORD)));
    expect(await signIn(user.email, PASSWORD)).not.toBeNull();
  });

  it("det 11. forsøg inden for 15 minutter bliver afvist (rate limit)", async () => {
    const user = await signUp();
    const clubId = await createClub(user);
    setActor(user);
    rateLimits.disabled = false;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const result = await changePasswordAction(null, passwordForm(clubId, "forkert-password"));
      expect(result).toMatchObject({ error: { code: "INVALID_PASSWORD" } });
    }
    const limited = await changePasswordAction(null, passwordForm(clubId, PASSWORD));

    expect(limited).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.RATE_LIMITED },
      values: {},
    });
    // The right password was never tried, so the old one still works.
    rateLimits.disabled = true;
    expect(await signIn(user.email, PASSWORD)).not.toBeNull();
  });
});
