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
