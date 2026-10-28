import "server-only";

import { isExternalProvider, type ExternalProviderId } from "@/lib/auth-providers";
import { db } from "@/server/db";
import { homeDestinationPath, resolveHomeDestination } from "@/server/domain/routing";

/**
 * Read queries for users (SPEC §9.8). Not club-scoped: a user's own data,
 * always looked up by the id of the logged-in user (requireUser()).
 */

/** The user's stored name, or null when the user no longer exists. */
export async function getUserName(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? null;
}

export type AccountLogins = {
  hasPassword: boolean;
  /** Stable order: callers use external[0]. */
  external: ExternalProviderId[];
};

/**
 * How the user logs in (§9.8, D-106): "Skift password" needs a password login;
 * an account with only an external login (Google or Auth0) gets the
 * explanation instead.
 */
export async function getAccountLogins(userId: string): Promise<AccountLogins> {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { providerId: true, password: true },
    orderBy: { providerId: "asc" },
  });
  const external: ExternalProviderId[] = [];
  for (const { providerId } of accounts) {
    if (isExternalProvider(providerId) && !external.includes(providerId)) external.push(providerId);
  }
  return {
    hasPassword: accounts.some(
      (account) => account.providerId === "credential" && account.password !== null,
    ),
    external,
  };
}

/** The latest stored id token (replaced on every sign-in), for Auth0's auth_time (D-166). */
export async function getExternalIdToken(
  userId: string,
  providerId: ExternalProviderId,
): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId },
    orderBy: { updatedAt: "desc" },
    select: { idToken: true },
  });
  return account?.idToken ?? null;
}

/**
 * The ids of the user's clubs, read fresh (NOT the request-cached
 * getUserClubs): after leaving or deleting a club, the redirect target must
 * not include it (D-104).
 */
export async function listUserClubIds(userId: string): Promise<string[]> {
  const memberships = await db.membership.findMany({
    where: { userId },
    select: { clubId: true },
    orderBy: { clubId: "asc" },
  });
  return memberships.map((membership) => membership.clubId);
}

/**
 * Where to send the user after leaving or deleting a club (D-104, E15):
 * onboarding (no clubs left), the one remaining club, or the club picker.
 * Built from a fresh club list (listUserClubIds) and WITHOUT lastActiveClubId,
 * which may still point at the club that is gone.
 */
export async function homePathAfterLeaving(userId: string): Promise<string> {
  return homeDestinationPath(
    resolveHomeDestination({ clubIds: await listUserClubIds(userId), lastActiveClubId: null }),
  );
}
