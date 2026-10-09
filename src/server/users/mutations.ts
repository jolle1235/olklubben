import "server-only";

import { db } from "@/server/db";
import { cleanNickname, cleanUserName } from "@/server/domain/users/user-name";

/**
 * Writes for the user's own profile and sessions (SPEC §9.8, D-105, D-106).
 * Authorization is the caller's job: always the logged-in user's own id.
 */

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("Brugeren findes ikke.");
    this.name = "UserNotFoundError";
  }
}

/**
 * Saves the official name and the global nickname together (the ONLY writer
 * of users.nickname; Better Auth refuses it as input). Both are cleaned once
 * more (cleanUserName / cleanNickname) behind the Zod schema; an empty
 * nickname clears it. Returns the stored values.
 * Throws UserNotFoundError when the user is gone, and refuses an empty name.
 */
export async function updateUserProfile(
  userId: string,
  input: { name: string; nickname: string | null },
): Promise<{ name: string; nickname: string | null }> {
  const name = cleanUserName(input.name);
  if (name === "") throw new Error("updateUserProfile: navnet er tomt.");
  const nickname = cleanNickname(input.nickname);
  const { count } = await db.user.updateMany({ where: { id: userId }, data: { name, nickname } });
  if (count !== 1) throw new UserNotFoundError();
  return { name, nickname };
}

/**
 * Logs the user out everywhere except the current session (after a password
 * change, D-106). Returns how many sessions were deleted.
 */
export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { userId, NOT: { id: keepSessionId } },
  });
  return count;
}
