/**
 * Normalizing user names before they are stored (SPEC §6.1, §11: 1–100
 * characters). The forms validate with Zod first; this is the server-side
 * safety net for every path into the users table (sign-up API, Google
 * profile, profile update), backed by a CHECK constraint.
 *
 * Pure module: no Next.js, React or database imports.
 */

import { USER_NAME_MAX_LENGTH } from "@/lib/validation/auth";

/** Re-exported for callers of this module; defined once, next to the Zod schema. */
export { USER_NAME_MAX_LENGTH };

/** Name used when neither the input nor the email gives anything usable. */
export const FALLBACK_USER_NAME = "Ølentusiast";

/** Trims, collapses inner whitespace and cuts to 100 characters. "" when nothing is left. */
export function cleanUserName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  // Cut by code points, so an emoji is never split in half.
  return Array.from(collapsed).slice(0, USER_NAME_MAX_LENGTH).join("").trim();
}

/**
 * The name to store for a new user: the cleaned name, else the part of the
 * email before "@", else FALLBACK_USER_NAME. Never empty.
 */
export function resolveNewUserName(rawName: unknown, email: unknown): string {
  const name = cleanUserName(rawName);
  if (name) return name;
  if (typeof email === "string") {
    const localPart = cleanUserName(email.split("@")[0]);
    if (localPart) return localPart;
  }
  return FALLBACK_USER_NAME;
}
