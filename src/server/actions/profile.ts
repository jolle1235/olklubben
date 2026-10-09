"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  rateLimitedError,
  unexpectedError,
  validationError,
  type ActionError,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { profileHref } from "@/lib/routes";
import { idSchema } from "@/lib/validation/id";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validation/profile";
import { auth } from "@/server/auth/auth";
import { toAuthActionError } from "@/server/auth/errors";
import { revokePasswordResetTokens } from "@/server/auth/reset-link";
import { getSession, requireMembership } from "@/server/auth/session";
import { rateLimit } from "@/server/rate-limit";
import { revalidateAppShell } from "@/server/revalidate";
import { revokeOtherSessions, updateUserProfile } from "@/server/users/mutations";

/**
 * Server Actions for Profil (SPEC §9.8, D-105, D-106): name + nickname, and
 * changing the password. Both forms live on /c/[clubId]/profile (D-023) and
 * send the club's id (hidden) only to know where to go back to; a malformed
 * id or a club the user has left gives a 404 (E16).
 *
 * Order (§4.3): ids → the shared Zod schema → membership → write → revalidate
 * → redirect with a toast (D-075), so both forms also work without JavaScript.
 */

/** What was typed, echoed back after a failed submit (React resets the form). */
export type ProfileFormValues = { name?: string; nickname?: string };

/** The form state for useActionState: null before the first submit. Success redirects. */
export type ProfileFormState = FormFailure<ProfileFormValues> | null;

/** Passwords are never echoed back, so a failed password change returns no values. */
export type ChangePasswordFormState = FormFailure<Record<string, never>> | null;

/** An echoed value is capped, so a forged request cannot bounce megabytes back. */
const MAX_ECHO_LENGTH = 2000;

/** "Skift password": 10 attempts per user per 15 minutes (on top of the IP rule, D-106). */
const CHANGE_PASSWORD_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

const SESSIONS_NOT_REVOKED =
  "Dit nye password er gemt, men vi kunne ikke logge dine andre enheder ud. Prøv at skifte password igen.";

function readProfileValues(formData: FormData): ProfileFormValues {
  const raw = readFormValues(formData);
  const values: ProfileFormValues = {};
  for (const field of ["name", "nickname"] as const) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHO_LENGTH);
  }
  return values;
}

/**
 * "Gem profil": the official name (1–100) and the global nickname (optional,
 * 1–40; empty clears it). Written by updateUserProfile only: Better Auth
 * refuses the nickname as input (D-105). The name and nickname show in the
 * sidebar of every club, so the whole app shell is revalidated.
 * Form fields: clubId (hidden), name, nickname.
 */
export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const values = readProfileValues(formData);
  const parsed = updateProfileSchema.safeParse(values);
  if (!parsed.success) return { ...validationError(parsed.error), values };

  const { user, club } = await requireMembership(clubId.data);

  try {
    await updateUserProfile(user.id, parsed.data);
  } catch (error) {
    console.error("[profile] updateUserProfile failed", error);
    return { ...unexpectedError(), values };
  }

  revalidateAppShell();
  redirect(withToast(profileHref(club.id), "profile-updated"));
}

function passwordFailure(result: { ok: false; error: ActionError }): ChangePasswordFormState {
  return { ...result, values: {} };
}

/**
 * "Skift password" (§9.8, D-106): the current password, the new one twice.
 *
 * Better Auth checks the current password and saves the new one, WITHOUT
 * revoking sessions itself (revokeOtherSessions:false): its revoke would swap
 * the session cookie inside this action while the page still reads the old
 * one, logging the user out here. Instead the app deletes every OTHER session
 * of the user and every outstanding reset link (D-047), so this device stays
 * logged in and an old link cannot undo the change.
 *
 * Rate limited per user (here) and per IP (Better Auth's before hook). A wrong
 * current password becomes a field error on currentPassword; an account
 * without a password (Google only) gets a form error. Passwords are never
 * echoed. Form fields: clubId (hidden), currentPassword, newPassword,
 * confirmPassword.
 */
export async function changePasswordAction(
  _previous: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const parsed = changePasswordSchema.safeParse(readFormValues(formData));
  if (!parsed.success) return passwordFailure(validationError(parsed.error));

  const { user, club } = await requireMembership(clubId.data);
  // requireMembership has just read it (cached per request).
  const session = await getSession();
  if (!session) return passwordFailure(unexpectedError());

  const limited = await rateLimit(`password:change:user:${user.id}`, CHANGE_PASSWORD_LIMIT);
  if (!limited.ok) return passwordFailure(rateLimitedError(limited.retryAfterSeconds));

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (error) {
    // Rethrows anything that is not a Better Auth error (fx the database is down).
    return passwordFailure(toAuthActionError(error, "change-password"));
  }

  try {
    await revokeOtherSessions(user.id, session.session.id);
    await revokePasswordResetTokens(user.id);
  } catch (error) {
    console.error("[profile] revoking sessions after a password change failed", error);
    return passwordFailure(unexpectedError(SESSIONS_NOT_REVOKED));
  }

  redirect(withToast(profileHref(club.id), "password-changed"));
}
