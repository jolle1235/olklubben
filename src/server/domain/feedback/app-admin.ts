/**
 * App-admin (SPEC §9.9, D-142): the people who set a report's status, answer
 * it, mark duplicates and see the technical info. Decided ONLY by the
 * APP_ADMIN_EMAILS list (src/env.ts → appAdminEmails, already lowercased and
 * de-duplicated). It has nothing to do with club roles: a club admin is not
 * an app-admin, and this function never looks at a membership.
 *
 * Exact match after trim + lowercase (account emails are stored lowercase):
 * "xjesper@example.com" is not "jesper@example.com".
 *
 * This only answers "is the email on the list". Rights also need a verified
 * email (getFeedbackViewer in src/server/feedback/access.ts, D-165).
 *
 * Pure module: the list is passed in (no env import). Client-safe.
 */
export function isAppAdmin(
  email: string | null | undefined,
  adminEmails: readonly string[],
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || adminEmails.length === 0) return false;
  return adminEmails.some((admin) => admin.trim().toLowerCase() === normalized);
}
