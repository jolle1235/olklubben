import "server-only";

import { APIError, createAuthMiddleware, getIP } from "better-auth/api";

import { formatWait } from "@/lib/action-result";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { EMAIL_DELIVERY_UNAVAILABLE, isEmailDeliveryAvailable } from "@/server/email/send-email";
import { hashRateLimitPart, rateLimit, type RateLimitOptions } from "@/server/rate-limit";

/**
 * Better Auth's `hooks.before` (auth.ts): guards for the sensitive auth
 * endpoints (SPEC §4.7: login, signup, forgot password).
 *
 *   1. "Glemt password" is rejected up front when no email can be sent
 *      (production without SMTP, SPEC §6.4, D-024).
 *   2. Rate limits.
 *
 * Why a hook instead of Better Auth's `rateLimit.customRules`: Better Auth only
 * rate-limits requests that come through its HTTP handler (/api/auth/*). Calls
 * from Server Actions (`auth.api.signInEmail(…)`) skip that limiter. A
 * `hooks.before` middleware runs for both entry points, so these limits hold
 * however the forms are built. The built-in limiter is switched off for these
 * paths (auth.ts) so requests are not counted twice.
 *
 * Generous on purpose: a whole club may sign up from the same pub wifi (one
 * IP) on a tasting night (SPEC §1.1).
 */

/** The endpoint behind "Glemt password" (authClient/auth.api.requestPasswordReset). */
const REQUEST_PASSWORD_RESET_PATH = "/request-password-reset";

/**
 * Without email delivery (production without SMTP) a reset request could only
 * fail later, in the background, after a "we sent a link" response. Reject it
 * before anything happens, with the same code and message the "Glemt password"
 * page shows ("Kontakt en admin i din klub …", SPEC §6.4).
 *
 * Only the request is blocked: /reset-password stays open, because the
 * admin-generated link (D-017) is exactly the fallback for this situation.
 */
export function assertPasswordResetDeliverable(
  path: string,
  emailDeliveryAvailable: boolean,
): void {
  if (path !== REQUEST_PASSWORD_RESET_PATH || emailDeliveryAvailable) return;
  throw new APIError("BAD_REQUEST", {
    code: EMAIL_DELIVERY_UNAVAILABLE,
    message: AUTH_ERROR_MESSAGES.resetUnavailable,
  });
}

type AuthRateLimitRule = RateLimitOptions & {
  /** "ip": per client IP. "email": per email in the request body (hashed). */
  scope: "ip" | "email";
};

export const AUTH_RATE_LIMIT_RULES: Readonly<Record<string, readonly AuthRateLimitRule[]>> = {
  "/sign-in/email": [
    { scope: "ip", limit: 30, windowSeconds: 5 * 60 },
    { scope: "email", limit: 10, windowSeconds: 15 * 60 },
  ],
  "/sign-up/email": [{ scope: "ip", limit: 20, windowSeconds: 60 * 60 }],
  "/request-password-reset": [
    { scope: "ip", limit: 10, windowSeconds: 15 * 60 },
    // Stops anyone from flooding one inbox with reset emails.
    { scope: "email", limit: 3, windowSeconds: 60 * 60 },
  ],
  "/reset-password": [{ scope: "ip", limit: 10, windowSeconds: 15 * 60 }],
};

/** Paths handled here, for `rateLimit.customRules` in auth.ts. */
export const AUTH_RATE_LIMITED_PATHS = Object.keys(AUTH_RATE_LIMIT_RULES);

function readEmail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("email" in body)) return null;
  const email = (body as { email: unknown }).email;
  return typeof email === "string" && email.trim() !== "" ? email : null;
}

export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  assertPasswordResetDeliverable(ctx.path, isEmailDeliveryAvailable());

  const rules = AUTH_RATE_LIMIT_RULES[ctx.path];
  if (!rules) return;

  const source = ctx.request ?? ctx.headers;
  const ip = (source ? getIP(source, ctx.context.options) : null) ?? "unknown";
  const email = readEmail(ctx.body);

  for (const rule of rules) {
    let subject: string;
    if (rule.scope === "ip") {
      subject = `ip:${ip}`;
    } else {
      if (!email) continue;
      subject = `email:${await hashRateLimitPart(email)}`;
    }

    const result = await rateLimit(`auth:${ctx.path}:${subject}`, rule);
    if (!result.ok) {
      throw new APIError(
        "TOO_MANY_REQUESTS",
        {
          code: "TOO_MANY_REQUESTS",
          message: `For mange forsøg. Prøv igen om ${formatWait(result.retryAfterSeconds)}.`,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { "Retry-After": String(result.retryAfterSeconds) },
      );
    }
  }
});
