import "server-only";

import { db } from "@/server/db";

/**
 * Read queries for users (SPEC §9.8). Not club-scoped: a user's own data,
 * always looked up by the id of the logged-in user (requireUser()).
 */

/** The user's stored name, or null when the user no longer exists. */
export async function getUserName(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? null;
}

/**
 * How the user logs in (§9.8, D-106): "Skift password" needs a password login;
 * a Google-only account gets the explanation instead.
 */
export async function getAccountLogins(
  userId: string,
): Promise<{ hasPassword: boolean; hasGoogle: boolean }> {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { providerId: true, password: true },
  });
  return {
    hasPassword: accounts.some(
      (account) => account.providerId === "credential" && account.password !== null,
    ),
    hasGoogle: accounts.some((account) => account.providerId === "google"),
  };
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
