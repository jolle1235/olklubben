"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { fail, validationError, type ActionError } from "@/lib/action-result";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { afterAuthPath, withNext } from "@/lib/auth-links";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { auth } from "@/server/auth/auth";
import { toAuthActionError } from "@/server/auth/errors";
import { EMAIL_DELIVERY_UNAVAILABLE, isEmailDeliveryAvailable } from "@/server/email/send-email";

/**
 * Server Actions for the auth forms (SPEC §6): log ind, opret konto, glemt
 * password and nyt password. Used with useActionState, so the forms also work
 * without client JavaScript (progressive enhancement).
 *
 * Each action: Zod parse (the same schema as the form) → Better Auth
 * (auth.api.*, with the request headers so rate limits and IP apply, and
 * nextCookies sets the session cookie) → redirect on success. Better Auth
 * errors become Danish messages through toAuthActionError; sign-in errors are
 * always generic (§6.3).
 *
 * No login is required here: these are the ways in.
 */

/** Echoed back so the form keeps what was typed. Never passwords. */
export type AuthFormValues = { name?: string; email?: string };

/** null before the first submit. Success redirects, so only failures come back. */
export type AuthFormState = { ok: false; error: ActionError; values: AuthFormValues } | null;

/** "Glemt password" does not redirect: it shows the same note for every email (§6.4). */
export type ForgotPasswordState = AuthFormState | { ok: true; data: { email: string } };

const MAX_ECHO_LENGTH = 320;

function readString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function echo(value: string | undefined): string | undefined {
  return value?.slice(0, MAX_ECHO_LENGTH);
}

function failed(
  result: { ok: false; error: ActionError },
  values: AuthFormValues = {},
): AuthFormState {
  return { ...result, values };
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  };
  const values = { email: echo(input.email) };

  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    return failed(toAuthActionError(error, "sign-in"), values);
  }

  redirect(afterAuthPath(readString(formData, "next")));
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    name: readString(formData, "name"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
    confirmPassword: readString(formData, "confirmPassword"),
  };
  const values = { name: echo(input.name), email: echo(input.email) };

  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  try {
    // autoSignIn (auth.ts): the new user is logged in right away (§6.1).
    await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    return failed(toAuthActionError(error, "sign-up"), values);
  }

  redirect(afterAuthPath(readString(formData, "next")));
}

export async function requestPasswordResetAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const input = { email: readString(formData, "email") };
  const values = { email: echo(input.email) };

  // Production without SMTP: the page shows "Kontakt en admin …" instead of the
  // form; this is the server-side check (the auth hook refuses it as well).
  if (!isEmailDeliveryAvailable()) {
    return failed(fail(EMAIL_DELIVERY_UNAVAILABLE, AUTH_ERROR_MESSAGES.resetUnavailable), values);
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  try {
    // Same answer whether or not the email exists; the email itself is sent
    // after the response (auth.ts backgroundTasks). redirectTo carries a safe
    // ?next= (e.g. an invitation) into the reset link (sendResetPassword).
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: safeRedirectPath(readString(formData, "next")) ?? undefined,
      },
      headers: await headers(),
    });
  } catch (error) {
    return failed(toAuthActionError(error, "forgot-password"), values);
  }

  return { ok: true, data: { email: parsed.data.email } };
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    token: readString(formData, "token"),
    password: readString(formData, "password"),
    confirmPassword: readString(formData, "confirmPassword"),
  };

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    if (!input.token) return failed(fail("INVALID_TOKEN", AUTH_ERROR_MESSAGES.invalidResetToken));
    return failed(validationError(parsed.error));
  }

  try {
    // Consumes the one-time token and logs the account out everywhere (auth.ts).
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    return failed(toAuthActionError(error, "reset-password"));
  }

  // Back to login, still carrying ?next= (e.g. the invitation, §6.5).
  redirect(withNext("/login?reset=1", safeRedirectPath(readString(formData, "next"))));
}
