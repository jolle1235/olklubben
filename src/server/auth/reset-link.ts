import "server-only";

import { generateId } from "better-auth";

import { passwordResetUrl } from "@/lib/app-url";
import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";

import { auth, PASSWORD_RESET_TOKEN_TTL_SECONDS } from "./auth";

/**
 * One-time password reset links without email (SPEC §6.4, D-017).
 *
 * The admin-generated link uses exactly the same mechanism as Better Auth's
 * "forgot password" email: a verification row
 *   identifier = "reset-password:<token>" (stored hashed), value = <userId>,
 *   expiresAt  = now + 1 hour
 * written through Better Auth's internal adapter, and the same page
 * /reset-password?token=<token>, which calls resetPassword({ token, newPassword }).
 * Better Auth consumes the row atomically, so a link works once.
 *
 * Only the newest link works: making a link deletes the user's earlier reset
 * tokens (like a new invitation code), and a completed reset deletes all of
 * them (onPasswordReset in auth.ts). "Glemt password" does NOT purge, or anyone
 * who knows the email could cancel a pending link.
 *
 * Authorization is the caller's job: canGeneratePasswordResetLink() for the
 * admin's membership, the target is a member of the same club, and
 * canResetMemberPassword() (src/server/actions/clubs.ts).
 */

const RESET_IDENTIFIER_PREFIX = "reset-password:";

/** Length of Better Auth's own reset tokens (generateId(24), alphanumeric). */
const TOKEN_LENGTH = 24;

export class PasswordResetTargetNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("Brugeren findes ikke.");
    this.name = "PasswordResetTargetNotFoundError";
  }
}

/**
 * Creates a reset token for a user and returns the absolute link
 * (https://…/reset-password?token=…), valid for 1 hour and one use. Revokes
 * the user's earlier reset links (email or admin), so "Lav link" again
 * invalidates the previous one.
 * Throws PasswordResetTargetNotFoundError when the user does not exist.
 */
export async function createPasswordResetUrl(userId: string): Promise<string> {
  if (!isValidId(userId)) throw new PasswordResetTargetNotFoundError();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new PasswordResetTargetNotFoundError();

  const context = await auth.$context;
  // Reset rows are the only verification rows whose value is a bare user id
  // (identifiers are hashed, so they cannot be matched by prefix).
  await db.verification.deleteMany({ where: { value: user.id } });
  const token = generateId(TOKEN_LENGTH);
  await context.internalAdapter.createVerificationValue({
    identifier: `${RESET_IDENTIFIER_PREFIX}${token}`,
    value: user.id,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000),
  });

  return passwordResetUrl(token);
}

/**
 * True when the token belongs to an unused, unexpired reset link. Lets the
 * /reset-password page say "Linket er udløbet" before the user types a new
 * password. Does not consume the token.
 */
export async function isPasswordResetTokenValid(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 256) return false;
  const context = await auth.$context;
  const verification = await context.internalAdapter.findVerificationValue(
    `${RESET_IDENTIFIER_PREFIX}${token}`,
  );
  return verification !== null && verification.expiresAt > new Date();
}
