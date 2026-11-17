import "server-only";

import { GOOGLE_PROVIDER_ID } from "@/lib/google-login";
import { db } from "@/server/db";
import { homeDestinationPath, resolveHomeDestination } from "@/server/domain/routing";

/**
 * Read queries for users (SPEC §9.8). Not club-scoped: a user's own data,
 * always looked up by the id of the logged-in user (requireUser()).
 */

export type AccountLogins = {
  hasPassword: boolean;
  hasGoogle: boolean;
};

/**
 * How the user logs in (§9.8, D-106): "Skift password" needs a password login;
 * an account with only a Google login gets the explanation instead.
 */
export async function getAccountLogins(userId: string): Promise<AccountLogins> {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { providerId: true, password: true },
  });
  return {
    hasPassword: accounts.some(
      (account) => account.providerId === "credential" && account.password !== null,
    ),
    hasGoogle: accounts.some((account) => account.providerId === GOOGLE_PROVIDER_ID),
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
