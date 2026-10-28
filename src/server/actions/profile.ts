"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { appAdminEmails } from "@/env";
import {
  ACTION_ERROR_CODES,
  fail,
  rateLimitedError,
  unexpectedError,
  validationError,
  type ActionError,
  type FormFailure,
} from "@/lib/action-result";
import { AUTH_ERROR_MESSAGES, emailFollowsExternal } from "@/lib/auth-errors";
import { EXTERNAL_PROVIDERS } from "@/lib/auth-providers";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { profileHref } from "@/lib/routes";
import { idSchema } from "@/lib/validation/id";
import {
  changeEmailSchema,
  changePasswordSchema,
  PASSWORD_FIELDS,
  setPasswordSchema,
  updateProfileSchema,
} from "@/lib/validation/profile";
import { auth } from "@/server/auth/auth";
import { toAuthActionError } from "@/server/auth/errors";
import { claimsFromIdToken } from "@/server/auth/external-claims";
import { revokePasswordResetTokens } from "@/server/auth/reset-link";
import { getSession, requireMembership } from "@/server/auth/session";
import { isAppAdmin } from "@/server/domain/feedback/app-admin";
import { isFreshLogin } from "@/server/domain/users/login-freshness";
import { rateLimit } from "@/server/rate-limit";
import { revalidateAppShell } from "@/server/revalidate";
import {
  changeUserEmail,
  EmailInUseError,
  revokeOtherSessions,
  updateUserProfile,
} from "@/server/users/mutations";
import { getAccountLogins, getExternalIdToken } from "@/server/users/queries";

/**
 * Server Actions for Profil (SPEC §9.8, D-105, D-106, D-151, D-152): name +
 * nickname, "Skift password", "Skift email" and "Tilføj password". All forms
 * live on /c/[clubId]/profile (D-023) and send the club's id (hidden) only to
 * know where to go back to; a malformed id or a club the user has left gives
 * a 404 (E16).
 *
 * Order (§4.3): ids → the shared Zod schema → membership → write → revalidate
 * → redirect with a toast (D-075), so the forms also work without JavaScript.
 *
 * The session is read through headers(); none of these actions ever sets a
 * cookie, so this device stays logged in (D-106).
 */

/** What was typed, echoed back after a failed submit (React resets the form). */
export type ProfileFormValues = { name?: string; nickname?: string };

/** The form state for useActionState: null before the first submit. Success redirects. */
export type ProfileFormState = FormFailure<ProfileFormValues> | null;

/** Passwords are never echoed back, so a failed password change returns no values. */
export type ChangePasswordFormState = FormFailure<Record<string, never>> | null;

/** "Skift email": the two emails are echoed back, never the password. */
export type ChangeEmailFormValues = { newEmail?: string; confirmEmail?: string };

export type ChangeEmailFormState = FormFailure<ChangeEmailFormValues> | null;

/** "Tilføj password": nothing is echoed back. */
export type SetPasswordFormState = FormFailure<Record<string, never>> | null;

/** An echoed value is capped, so a forged request cannot bounce megabytes back. */
const MAX_ECHO_LENGTH = 2000;

/** "Skift password": 10 attempts per user per 15 minutes (on top of the IP rule, D-106). */
const CHANGE_PASSWORD_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

const SESSIONS_NOT_REVOKED =
  "Dit nye password er gemt, men vi kunne ikke logge dine andre enheder ud. Prøv at skifte password igen.";

/** "Skift email": 10 attempts per user per 15 minutes (on top of the IP rule on /verify-password, D-151). */
const CHANGE_EMAIL_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

/** "Tilføj password": 10 attempts per user per 15 minutes (D-152). */
const SET_PASSWORD_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

const EMAIL_IN_USE = "Den email bruges allerede af en anden konto.";
const EMAIL_UNCHANGED = "Det er allerede din email.";
const EMAIL_SESSIONS_NOT_REVOKED =
  "Din email er skiftet, men vi kunne ikke logge dine andre enheder ud. Prøv at skifte password.";
function reauthRequired(label: string): string {
  return `Log ind med ${label} igen for at tilføje et password.`;
}
const PASSWORD_SET_SESSIONS_NOT_REVOKED =
  "Dit password er gemt, men vi kunne ikke logge dine andre enheder ud. Prøv at skifte password.";

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
 * without a password (Google or Auth0 only) gets a form error. Passwords are never
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

/** The two emails as typed (capped), never the password. */
function readEmailValues(formData: FormData): ChangeEmailFormValues {
  const raw = readFormValues(formData, { exclude: PASSWORD_FIELDS });
  const values: ChangeEmailFormValues = {};
  for (const field of ["newEmail", "confirmEmail"] as const) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHO_LENGTH);
  }
  return values;
}

/**
 * "Skift email" (§9.8, D-151), for accounts with a password login: the new
 * email twice and the current password. Better Auth's own changeEmail stays
 * off: without verification it switches at once, asks for no password and
 * silently ignores an email that is in use.
 *
 *   1. Rate limited per user (here) and per IP (/verify-password, Better
 *      Auth's before hook).
 *   2. An account with only an external login gets a form error: its email
 *      follows that account (Google or Auth0).
 *   3. Its own email → "Det er allerede din email." (before the password).
 *   4. The current password through auth.api.verifyPassword; wrong → a field
 *      error on currentPassword.
 *   5. An address in APP_ADMIN_EMAILS gets exactly the "in use" answer, so
 *      app-admin cannot be claimed and the list cannot be probed (D-142).
 *   6. One UPDATE (changeUserEmail); the unique index decides a race. The
 *      email is stored lowercase and unverified, and every external login
 *      (Google, Auth0) is removed in the same transaction: it belonged to the
 *      old email (D-165, D-166, TG-064). The toast then says so.
 *   7. Every other session and every outstanding reset link is revoked
 *      (D-047); this device stays logged in.
 *
 * No mail to the old address yet (no SMTP/domain, TG-033). The sidebar shows
 * the email, so the whole app shell is revalidated.
 * Form fields: clubId (hidden), newEmail, confirmEmail, currentPassword.
 */
export async function changeEmailAction(
  _previous: ChangeEmailFormState,
  formData: FormData,
): Promise<ChangeEmailFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const values = readEmailValues(formData);
  const parsed = changeEmailSchema.safeParse(readFormValues(formData));
  if (!parsed.success) return { ...validationError(parsed.error), values };
  const { newEmail, currentPassword } = parsed.data;

  const { user, club } = await requireMembership(clubId.data);
  // requireMembership has just read it (cached per request).
  const session = await getSession();
  if (!session) return { ...unexpectedError(), values };

  const limited = await rateLimit(`email:change:user:${user.id}`, CHANGE_EMAIL_LIMIT);
  if (!limited.ok) return { ...rateLimitedError(limited.retryAfterSeconds), values };

  const logins = await getAccountLogins(user.id);
  if (!logins.hasPassword) {
    return {
      ...fail(
        ACTION_ERROR_CODES.FORBIDDEN,
        emailFollowsExternal(EXTERNAL_PROVIDERS[logins.external[0] ?? "google"].label),
      ),
      values,
    };
  }

  if (newEmail === user.email) {
    return {
      ...fail(ACTION_ERROR_CODES.VALIDATION, EMAIL_UNCHANGED, { newEmail: [EMAIL_UNCHANGED] }),
      values,
    };
  }

  try {
    await auth.api.verifyPassword({
      body: { password: currentPassword },
      headers: await headers(),
    });
  } catch (error) {
    // Rethrows anything that is not a Better Auth error (fx the database is down).
    return { ...toAuthActionError(error, "change-email"), values };
  }

  const emailInUse = {
    ...fail(ACTION_ERROR_CODES.EMAIL_IN_USE, EMAIL_IN_USE, { newEmail: [EMAIL_IN_USE] }),
    values,
  };
  if (isAppAdmin(newEmail, appAdminEmails)) return emailInUse;

  let unlinkedExternal: boolean;
  try {
    ({ unlinkedExternal } = await changeUserEmail(user.id, newEmail));
  } catch (error) {
    if (error instanceof EmailInUseError) return emailInUse;
    console.error("[profile] changeUserEmail failed", error);
    return { ...unexpectedError(), values };
  }

  try {
    await revokeOtherSessions(user.id, session.session.id);
    await revokePasswordResetTokens(user.id);
  } catch (error) {
    console.error("[profile] revoking sessions after an email change failed", error);
    return { ...unexpectedError(EMAIL_SESSIONS_NOT_REVOKED), values };
  }

  revalidateAppShell();
  redirect(
    withToast(profileHref(club.id), unlinkedExternal ? "email-changed-external" : "email-changed"),
  );
}

function setPasswordFailure(result: { ok: false; error: ActionError }): SetPasswordFormState {
  return { ...result, values: {} };
}

/**
 * "Tilføj password" (§9.8, D-152, D-166): an account with only an external
 * login (Google or Auth0) picks its first password, so it can also log in
 * with email and password. There is no current password to confirm, and
 * Better Auth's setPassword has no freshness check, so the session must come
 * from an external login less than 10 minutes ago (isFreshLogin on
 * session.createdAt), and for Auth0 so must the stored id token's auth_time;
 * otherwise REAUTH_REQUIRED and Better Auth is never called. Profil then offers "Log
 * ind med … igen" (with prompt=login for Auth0).
 *
 * An account that already has a password (fx set in another tab) gets a form
 * error, from the check here or from Better Auth (PASSWORD_ALREADY_SET).
 * Afterwards every other session and every outstanding reset link is revoked
 * (D-047); this device stays logged in. The external login stays, so admin
 * reset links stay refused (D-046). Passwords are never echoed.
 * Form fields: clubId (hidden), newPassword, confirmPassword.
 */
export async function setPasswordAction(
  _previous: SetPasswordFormState,
  formData: FormData,
): Promise<SetPasswordFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const parsed = setPasswordSchema.safeParse(readFormValues(formData));
  if (!parsed.success) return setPasswordFailure(validationError(parsed.error));

  const { user, club } = await requireMembership(clubId.data);
  // requireMembership has just read it (cached per request).
  const session = await getSession();
  if (!session) return setPasswordFailure(unexpectedError());

  const logins = await getAccountLogins(user.id);
  if (logins.hasPassword) {
    return setPasswordFailure(fail("PASSWORD_ALREADY_SET", AUTH_ERROR_MESSAGES.passwordAlreadySet));
  }
  // Neither an external login nor a password: nothing this form is meant for.
  const provider = logins.external[0];
  if (!provider) return setPasswordFailure(unexpectedError());
  const reauth = fail(
    ACTION_ERROR_CODES.REAUTH_REQUIRED,
    reauthRequired(EXTERNAL_PROVIDERS[provider].label),
  );

  const now = new Date();
  if (!isFreshLogin(session.session.createdAt, now)) return setPasswordFailure(reauth);
  // Auth0's single sign-on can create a session without a real login (fx from
  // another app on the tenant); auth_time is when the user really logged in.
  if (logins.external.includes("auth0")) {
    const authTime = claimsFromIdToken(await getExternalIdToken(user.id, "auth0"))?.authTime;
    if (!authTime || !isFreshLogin(authTime, now)) return setPasswordFailure(reauth);
  }

  const limited = await rateLimit(`password:set:user:${user.id}`, SET_PASSWORD_LIMIT);
  if (!limited.ok) return setPasswordFailure(rateLimitedError(limited.retryAfterSeconds));

  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: await headers(),
    });
  } catch (error) {
    // Rethrows anything that is not a Better Auth error (fx the database is down).
    return setPasswordFailure(toAuthActionError(error, "set-password"));
  }

  try {
    await revokeOtherSessions(user.id, session.session.id);
    await revokePasswordResetTokens(user.id);
  } catch (error) {
    console.error("[profile] revoking sessions after setting a password failed", error);
    return setPasswordFailure(unexpectedError(PASSWORD_SET_SESSIONS_NOT_REVOKED));
  }

  redirect(withToast(profileHref(club.id), "password-set"));
}
