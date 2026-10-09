import "server-only";

import { isAPIError } from "better-auth/api";

import { fail, rateLimitedError, type ActionError } from "@/lib/action-result";
import { getAuthErrorMessage, type AuthErrorLike, type AuthFlow } from "@/lib/auth-errors";

/**
 * Turning errors from `auth.api.*` (Better Auth APIError) into ActionResults
 * for Server Actions:
 *
 *   try {
 *     await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
 *   } catch (error) {
 *     return toAuthActionError(error, "sign-in");   // rethrows non-auth errors
 *   }
 *   redirect(safeRedirectPath(next) ?? (await getHomePath(...)));
 */

/** { code, status } of a Better Auth APIError, or null for any other error. */
export function getAuthErrorInfo(error: unknown): (AuthErrorLike & { status: number }) | null {
  if (!isAPIError(error)) return null;
  const code = typeof error.body?.code === "string" ? error.body.code : null;
  return { code, status: error.statusCode };
}

/**
 * A failed ActionResult with a Danish message for a Better Auth error.
 * Anything that is not a Better Auth APIError (database down, Next.js
 * redirect/notFound signals) is rethrown untouched.
 *
 * 429 (our auth rate limits, auth-rate-limit.ts) becomes RATE_LIMITED with the
 * wait, like join-with-code: "For mange forsøg. Prøv igen om 3 minutter."
 * That is safe on sign-in too: the per-email limit counts any submitted email,
 * so the wait reveals nothing about which accounts exist (§6.3).
 *
 * "change-password": a wrong current password becomes a field error on
 * `currentPassword` (D-056 moves focus there); a Google-only account gets a
 * form error.
 */
export function toAuthActionError(
  error: unknown,
  flow: AuthFlow,
): { ok: false; error: ActionError } {
  const info = getAuthErrorInfo(error);
  if (!info) throw error;
  if (info.status === 429) return rateLimitedError(readRetryAfterSeconds(error));
  const message = getAuthErrorMessage(info, flow);
  if (flow === "change-password" && info.code === "INVALID_PASSWORD") {
    return fail(info.code, message, { currentPassword: [message] });
  }
  return fail(info.code ?? "AUTH_ERROR", message);
}

/** `retryAfterSeconds` from our 429 body (auth-rate-limit.ts), when it is a number. */
function readRetryAfterSeconds(error: unknown): number | undefined {
  const value: unknown = isAPIError(error) ? error.body?.retryAfterSeconds : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
