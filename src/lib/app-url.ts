import "server-only";

import { env } from "@/env";
import { withNext } from "@/lib/auth-links";

/**
 * Absolute URLs to the app (invitation links, reset links, emails).
 *
 * Based on BETTER_AUTH_URL, which is set per environment (SPEC §4.8):
 * http://localhost:3000 locally, https://<projekt>.vercel.app in production.
 *
 * Server-only (reads the validated env). Pass the finished URL to client
 * components as a prop.
 */

export function getAppUrl(): string {
  return env.BETTER_AUTH_URL.replace(/\/+$/, "");
}

/** Absolute URL for a path on this app: appUrl("/login") → "https://…/login". */
export function appUrl(path: string): string {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The invitation link for a canonical code (SPEC §7.3): https://<domæne>/join/K7XMQ2PA */
export function inviteUrl(code: string): string {
  return appUrl(`/join/${encodeURIComponent(code)}`);
}

/**
 * The "choose a new password" page for a reset token (SPEC §6.4). Used by both
 * the email link and the admin-generated link: /reset-password?token=<token>.
 * The email link may add a safe `next` (e.g. an invitation the user was on,
 * §6.5): …&next=%2Fjoin%2F<code>. Admin links never have one.
 */
export function passwordResetUrl(token: string, next?: string | null): string {
  return appUrl(withNext(`/reset-password?token=${encodeURIComponent(token)}`, next));
}
