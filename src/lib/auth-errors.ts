/**
 * Danish messages for Better Auth errors (SPEC §6), for both entry points:
 *
 *   * the browser client: `const { error } = await authClient.signIn.email(…)`
 *     → getAuthErrorMessage(error, "sign-in")
 *   * Server Actions calling auth.api.*: use toAuthActionError() from
 *     src/server/auth/errors.ts, which uses this file.
 *
 * Sign-in never reveals whether an email exists (SPEC §6.3).
 *
 * Client-safe: no server-only imports.
 */

import { DEFAULT_ERROR_MESSAGES } from "./action-result";

export type AuthFlow = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "generic";

/** The shape of both a Better Auth client error and a server APIError (normalized). */
export type AuthErrorLike = {
  code?: string | null;
  status?: number | null;
};

export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: "Forkert email eller password.",
  emailTaken:
    "Der findes allerede en konto med den email. Log ind i stedet, eller brug “Glemt password”.",
  passwordTooShort: "Password skal være mindst 8 tegn.",
  passwordTooLong: "Password må højst være 128 tegn.",
  invalidEmail: "Skriv en gyldig email, fx navn@example.com.",
  invalidResetToken: "Linket er udløbet eller allerede brugt. Bed om et nyt link.",
  resetUnavailable: "Kontakt en admin i din klub for at få et nulstillingslink.",
  rateLimited: DEFAULT_ERROR_MESSAGES.RATE_LIMITED,
  unexpected: DEFAULT_ERROR_MESSAGES.UNEXPECTED,
} as const;

const CREDENTIAL_CODES = new Set([
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_PASSWORD",
  "USER_NOT_FOUND",
  "CREDENTIAL_ACCOUNT_NOT_FOUND",
]);

export function getAuthErrorMessage(
  error: AuthErrorLike | null | undefined,
  flow: AuthFlow = "generic",
): string {
  if (!error) return AUTH_ERROR_MESSAGES.unexpected;
  const code = error.code ?? undefined;

  if (error.status === 429 || code === "TOO_MANY_REQUESTS") return AUTH_ERROR_MESSAGES.rateLimited;

  if (
    flow === "sign-in" &&
    code !== undefined &&
    (CREDENTIAL_CODES.has(code) || code === "INVALID_EMAIL")
  ) {
    // Generic on purpose: never reveal whether the email exists.
    return AUTH_ERROR_MESSAGES.invalidCredentials;
  }

  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return AUTH_ERROR_MESSAGES.emailTaken;
    case "PASSWORD_TOO_SHORT":
      return AUTH_ERROR_MESSAGES.passwordTooShort;
    case "PASSWORD_TOO_LONG":
      return AUTH_ERROR_MESSAGES.passwordTooLong;
    case "INVALID_EMAIL":
      return AUTH_ERROR_MESSAGES.invalidEmail;
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return AUTH_ERROR_MESSAGES.invalidResetToken;
    case "RESET_PASSWORD_DISABLED":
    case "EMAIL_DELIVERY_UNAVAILABLE":
      return AUTH_ERROR_MESSAGES.resetUnavailable;
    default:
      return AUTH_ERROR_MESSAGES.unexpected;
  }
}

/**
 * Message for the `?error=` parameter Better Auth adds when Google login fails
 * (it redirects to /login?error=<code>, see onAPIError.errorURL in auth.ts).
 * Returns null when there is no error.
 */
export function getOAuthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "account_not_linked":
    case "unable_to_link_account":
    case "email_does_not_match":
      // E19: an email/password account exists, and Google did not confirm the email.
      return "Der findes allerede en konto med den email. Log ind med email og password i stedet.";
    case "account_already_linked_to_different_user":
      return "Google-kontoen er allerede koblet til en anden bruger.";
    case "access_denied":
      return "Login med Google blev afbrudt.";
    case "email_not_found":
      return "Google gav os ikke din email, så vi kan ikke logge dig ind.";
    default:
      return "Login med Google mislykkedes. Prøv igen.";
  }
}
