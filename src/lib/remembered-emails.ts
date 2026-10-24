import { emailSchema } from "@/lib/validation/auth";

/**
 * The emails used to log in or sign up on THIS device (D-157), newest first,
 * offered as suggestions in the login and sign-up email fields. Browsers only
 * suggest what they have saved for this exact address, which is nothing on a
 * fresh install; this list works the same everywhere.
 *
 * Kept in localStorage under one key, at most 5, normalised like the forms'
 * own emailSchema (trimmed, lowercased, valid). Only emails, never passwords.
 *
 * Pure module: client-safe, no React.
 */

export const REMEMBERED_EMAILS_KEY = "olklubben.auth.emails";
export const MAX_REMEMBERED_EMAILS = 5;

/** The email as the forms store it, or null when it is not a valid email. */
export function normalizeRememberedEmail(email: string): string | null {
  const parsed = emailSchema.safeParse(email);
  return parsed.success ? parsed.data : null;
}

/** The stored JSON → the list (only this module writes it); anything else → []. */
export function parseRememberedEmails(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, MAX_REMEMBERED_EMAILS)
      : [];
  } catch {
    return [];
  }
}

/** A normalised `email` first, without duplicates, at most MAX_REMEMBERED_EMAILS. */
export function withRememberedEmail(list: readonly string[], email: string): string[] {
  return [email, ...list.filter((e) => e !== email)].slice(0, MAX_REMEMBERED_EMAILS);
}
