import { randomUUID } from "node:crypto";

import { expect } from "vitest";

import type { ClubRole } from "@/generated/prisma/enums";
import { auth } from "@/server/auth/auth";
import { createClubWithAdmin } from "@/server/clubs/mutations";
import { db } from "@/server/db";
import { placeNameKey } from "@/server/domain/places/name";

import { assertItestDatabaseUrl } from "./env.mjs";

/**
 * Helpers for the integration tests (tests/integration/*.itest.ts). They
 * talk to the real database (olklubben_itest) and the real Better Auth.
 *
 * Server Actions read the session through next/headers. The test file mocks
 * that module with `nextHeadersModule` (below), which serves the cookie of the
 * current actor (setActor):
 *
 *   vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
 */

// Defence in depth: the worker must never touch another database.
assertItestDatabaseUrl(process.env.DATABASE_URL);

const PASSWORD = "itest-password-123";
/** Unique per test file, so files never share emails. The DB is emptied per run. */
const RUN_ID = randomUUID().slice(0, 8);
let userCount = 0;

export type TestUser = {
  id: string;
  email: string;
  name: string;
  /** "better-auth.session_token=…", as the browser would send it. */
  cookie: string;
};

// ── next/headers ────────────────────────────────────────────────────────────

let currentHeaders = new Headers();

/** The user the next Server Action call runs as (null: logged out). */
export function setActor(user: TestUser | null): void {
  currentHeaders = new Headers(user ? { cookie: user.cookie } : {});
}

/**
 * Replacement for next/headers outside a Next.js request: `headers()` returns
 * the current actor's request headers. `cookies()` is a no-op store for Better
 * Auth's nextCookies plugin, which writes auth cookies through it. (Today the
 * plugin loads the real next/headers, because Vitest does not transform
 * node_modules, and skips the write outside a request scope.)
 */
export const nextHeadersModule = {
  headers: async () => currentHeaders,
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }),
};

// ── Data ────────────────────────────────────────────────────────────────────

/** Signs up a user through Better Auth (itest-<n>@example.test) and keeps the session cookie. */
export async function createUser(name = "Itest Bruger"): Promise<TestUser> {
  userCount += 1;
  const email = `itest-${RUN_ID}-${userCount}@example.test`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { name, email, password: PASSWORD },
    returnHeaders: true,
  });
  const sessionCookie = headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0] ?? "")
    .find((cookie) => cookie.startsWith("better-auth.session_token="));
  if (!sessionCookie) throw new Error("signUpEmail satte ingen session-cookie.");
  return { id: response.user.id, email, name, cookie: sessionCookie };
}

/** A club with `admin` as its Admin and its first invitation code (like createClub). */
export async function createClub(admin: TestUser, name = "Itest-klubben"): Promise<string> {
  const { clubId } = await createClubWithAdmin({ userId: admin.id, name });
  return clubId;
}

export async function addMember(
  clubId: string,
  user: TestUser,
  role: ClubRole = "MEMBER",
): Promise<void> {
  await db.membership.create({ data: { clubId, userId: user.id, role } });
}

/** Gives the user a Google login next to the password (like E19 account linking). */
export async function addGoogleAccount(user: TestUser): Promise<void> {
  await db.account.create({
    data: { userId: user.id, providerId: "google", accountId: `google-${user.id}` },
  });
}

/** The club's unrevoked invitation (findFirst, never findUnique: TG-004). */
export async function activeInvite(clubId: string) {
  return db.invite.findFirst({ where: { clubId, revokedAt: null } });
}

/** A submitted form. A list becomes a repeated field (fx hostIds). */
export function formData(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const item of value) data.append(key, item);
    else data.set(key, value);
  }
  return data;
}

/**
 * A place in the club, written directly (round 3). Owners must be members
 * (the composite FK refuses anyone else). Returns its id.
 */
export async function createPlace(
  clubId: string,
  creator: TestUser,
  name: string,
  options: { address?: string | null; ownerIds?: string[]; archived?: boolean } = {},
): Promise<string> {
  const place = await db.place.create({
    data: {
      clubId,
      createdById: creator.id,
      name,
      nameKey: placeNameKey(name),
      address: options.address ?? null,
      archivedAt: options.archived ? new Date() : null,
    },
    select: { id: true },
  });
  if (options.ownerIds?.length) {
    await db.placeOwner.createMany({
      data: options.ownerIds.map((userId) => ({ placeId: place.id, clubId, userId })),
    });
  }
  return place.id;
}

// ── Next.js control flow ────────────────────────────────────────────────────

async function rejection(promise: Promise<unknown>): Promise<{ digest?: unknown }> {
  try {
    await promise;
  } catch (error) {
    return error as { digest?: unknown };
  }
  throw new Error("Forventede, at handlingen kastede (notFound/redirect), men den returnerede.");
}

/** The action called notFound() (a 404 for the user, SPEC §4.4). */
export async function expectNotFound(promise: Promise<unknown>): Promise<void> {
  const error = await rejection(promise);
  expect(error.digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
}

/** The action called redirect(url) with a URL matching the pattern. Returns the URL. */
export async function expectRedirect(
  promise: Promise<unknown>,
  urlPattern: RegExp | string,
): Promise<string> {
  const error = await rejection(promise);
  const digest = typeof error.digest === "string" ? error.digest : "";
  expect(digest.startsWith("NEXT_REDIRECT;"), `ikke en redirect: ${String(error)}`).toBe(true);
  // "NEXT_REDIRECT;<type>;<url>;<status>;" (next/dist/client/components/redirect.js)
  const url = digest.split(";").slice(2, -2).join(";");
  expect(url).toMatch(urlPattern);
  return url;
}
