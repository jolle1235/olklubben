import "server-only";

import { parseEnv } from "@/lib/env-schema";

/**
 * Validated server environment (SPEC §4.7–4.8). Import from here, never read
 * `process.env` directly in application code.
 *
 * Validation runs once, when this module is first imported. Missing required
 * variables (DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL outside
 * Vercel Production, D-164) throw a clear error; missing optional ones only
 * switch the feature off.
 */
const parsed = parseEnv(process.env);

for (const warning of parsed.warnings) {
  console.warn(`[env] ${warning}`);
}

export const env = parsed.env;
/** The app's base URL without a trailing "/" (D-164). Use getAppUrl()/appUrl() from @/lib/app-url. */
export const appBaseUrl = parsed.appBaseUrl;
export const isGoogleConfigured = parsed.isGoogleConfigured;
export const isSmtpConfigured = parsed.isSmtpConfigured;
/** Rate limiting is off (RATE_LIMIT_DISABLED, never in production). */
export const isRateLimitDisabled = parsed.isRateLimitDisabled;
/**
 * The app-admins' emails (APP_ADMIN_EMAILS, lowercase, D-142). Use
 * isAppAdmin(user.email, appAdminEmails) from src/server/domain/feedback/app-admin.ts.
 */
export const appAdminEmails = parsed.appAdminEmails;
