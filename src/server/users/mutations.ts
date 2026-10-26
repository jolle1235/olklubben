import "server-only";

import { isUniqueConstraintError } from "@/server/clubs/unique-retry";
import { db } from "@/server/db";
import { cleanNickname, cleanUserName } from "@/server/domain/users/user-name";

/**
 * Writes for the user's own profile and sessions (SPEC §9.8, D-105, D-106,
 * D-151). Authorization is the caller's job: always the logged-in user's own
 * id.
 */

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("Brugeren findes ikke.");
    this.name = "UserNotFoundError";
  }
}

/** Another account already has the email (users_email_key, D-151). */
export class EmailInUseError extends Error {
  readonly code = "EMAIL_IN_USE";

  constructor() {
    super("Emailen bruges allerede af en anden konto.");
    this.name = "EmailInUseError";
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

/**
 * "Skift email" (D-151): stores the new email, trimmed and lowercased once
 * more behind the Zod schema (users_email_lowercase_check), and marks it
 * unverified (no verification mail until SMTP and a domain exist, TG-033).
 *
 * One UPDATE: the unique index users_email_key is the race-safe check, so two
 * accounts taking the same email at the same time cannot both succeed.
 * Throws EmailInUseError when another account has the email, and
 * UserNotFoundError when the user is gone.
 *
 * In the same transaction the user's Google login is removed (D-165): it
 * belongs to the old email, and a Google login must always be the account's
 * own email. Otherwise someone could link their own Google, change the email
 * to an address they do not own and keep logging in with Google after the
 * real owner reset the password (TG-064). Google can be linked again with
 * the new email. Returns the stored email and whether Google was removed.
 *
 * Never call it for a Google-only account or without checking the current
 * password: the Server Action (changeEmailAction) does both.
 */
export async function changeUserEmail(
  userId: string,
  email: string,
): Promise<{ email: string; unlinkedGoogle: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (normalized === "") throw new Error("changeUserEmail: emailen er tom.");
  try {
    return await db.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId },
        data: { email: normalized, emailVerified: false },
      });
      if (count !== 1) throw new UserNotFoundError();
      const google = await tx.account.deleteMany({ where: { userId, providerId: "google" } });
      return { email: normalized, unlinkedGoogle: google.count > 0 };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new EmailInUseError();
    throw error;
  }
}
