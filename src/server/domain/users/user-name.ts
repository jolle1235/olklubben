/**
 * Normalizing user names and nicknames before they are stored (SPEC §6.1,
 * §9.8, §11: name 1–100, nickname 1–40 characters). The forms validate with
 * Zod first; this is the server-side safety net for every path into the users
 * table (sign-up API, Google profile, profile update), backed by CHECK
 * constraints.
 *
 * Pure module: no Next.js, React or database imports.
 */

import { cleanSingleLine, stripNul } from "@/lib/text";
import { USER_NAME_MAX_LENGTH } from "@/lib/validation/auth";
import { NICKNAME_MAX_LENGTH } from "@/lib/validation/profile";

/** Re-exported for callers of this module; defined once, next to the Zod schemas. */
export { NICKNAME_MAX_LENGTH, USER_NAME_MAX_LENGTH };

/** Name used when neither the input nor the email gives anything usable. */
export const FALLBACK_USER_NAME = "Ølentusiast";

/**
 * Removes NUL (Postgres text cannot hold it, TG-029), trims, collapses inner
 * whitespace and cuts to 100 characters. "" when nothing is left.
 */
export function cleanUserName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const collapsed = stripNul(raw).replace(/\s+/g, " ").trim();
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

/**
 * The nickname to store (D-105): NUL removed, NFC, whitespace collapsed,
 * trimmed and cut to 40 characters (by code points, so an emoji is never split).
 * Null when nothing is left, which clears the nickname.
 */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = Array.from(cleanSingleLine(raw)).slice(0, NICKNAME_MAX_LENGTH).join("").trim();
  return cleaned === "" ? null : cleaned;
}
