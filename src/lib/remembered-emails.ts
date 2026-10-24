/**
 * The emails used to log in or sign up on THIS device (D-157), newest first,
 * offered as suggestions in the login and sign-up email fields. Browsers only
 * suggest what they have saved for this exact address, which is nothing on a
 * fresh install; this list works the same everywhere.
 *
 * Kept in localStorage under one key, at most 5, lowercased and unique. Only
 * emails, never passwords. Every access is wrapped in try/catch by the caller
 * (private mode, blocked storage): then there are simply no suggestions.
 *
 * Pure module: client-safe, no React.
 */

export const REMEMBERED_EMAILS_KEY = "olklubben.auth.emails";
export const MAX_REMEMBERED_EMAILS = 5;

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRememberedEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  return value.length <= 254 && LOOKS_LIKE_EMAIL.test(value) ? value : null;
}

/** The stored JSON → the list; anything unexpected → []. */
export function parseRememberedEmails(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      const email = typeof item === "string" ? normalizeRememberedEmail(item) : null;
      if (email && !out.includes(email)) out.push(email);
    }
    return out.slice(0, MAX_REMEMBERED_EMAILS);
  } catch {
    return [];
  }
}

/** `email` first, without duplicates, at most MAX_REMEMBERED_EMAILS. */
export function withRememberedEmail(list: readonly string[], email: string): string[] {
  const value = normalizeRememberedEmail(email);
  if (!value) return [...list];
  return [value, ...list.filter((e) => e !== value)].slice(0, MAX_REMEMBERED_EMAILS);
}

export function withoutRememberedEmail(list: readonly string[], email: string): string[] {
  const value = normalizeRememberedEmail(email);
  return list.filter((e) => e !== value);
}
