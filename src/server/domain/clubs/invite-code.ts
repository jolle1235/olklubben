/**
 * Invitation codes (SPEC §7.3).
 *
 * A code is 8 characters from an alphabet without look-alike characters
 * (no 0/O and no 1/I/L). It is stored canonical (uppercase, no hyphen) and
 * shown as two groups: "K7XM-Q2PA". Input is case-insensitive and ignores
 * hyphens and whitespace.
 *
 * Pure module: no Next.js, React or database imports. Uses the Web Crypto API
 * (globalThis.crypto), which exists in Node.js and in browsers.
 */

/** The 31 characters a code may contain. Mirrored by the CHECK constraint on invites.code. */
export const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const INVITE_CODE_LENGTH = 8;

const ALPHABET_SET = new Set(INVITE_ALPHABET);

// Rejection sampling keeps every character equally likely: bytes at or above
// the largest multiple of the alphabet size (248 = 31 · 8) are thrown away.
const UNBIASED_BYTE_LIMIT = 256 - (256 % INVITE_ALPHABET.length);

/**
 * Generates a new random code (canonical form, e.g. "K7XMQ2PA").
 * About 39.6 bits of entropy (31^8 ≈ 8.5 · 10^11 codes).
 */
export function generateInviteCode(): string {
  let code = "";
  while (code.length < INVITE_CODE_LENGTH) {
    const bytes = new Uint8Array(INVITE_CODE_LENGTH * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= UNBIASED_BYTE_LIMIT) continue;
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }
  return code;
}

// Hyphen-like characters that phone keyboards produce for "-" (en/em dash,
// minus sign …) and every kind of whitespace.
const IGNORED_CHARACTERS = /[\s\-‐-―−]/g;

/**
 * Turns user input into the canonical code, or returns null when it cannot be
 * a valid code (wrong length or characters outside INVITE_ALPHABET).
 *
 * Accepts "k7xm-q2pa", " K7XM Q2PA ", "K7XMQ2PA" and a pasted invitation link
 * ("https://…/join/K7XM-Q2PA"). Look-alike characters (0, O, 1, I, L) are
 * rejected rather than guessed.
 */
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;

  let raw = input;
  const joinIndex = raw.lastIndexOf("/join/");
  if (joinIndex !== -1) {
    raw = raw.slice(joinIndex + "/join/".length).split(/[/?#]/)[0] ?? "";
  }

  const candidate = raw.replace(IGNORED_CHARACTERS, "").toUpperCase();
  if (candidate.length !== INVITE_CODE_LENGTH) return null;
  for (const character of candidate) {
    if (!ALPHABET_SET.has(character)) return null;
  }
  return candidate;
}

/**
 * Formats a canonical code for display: "K7XMQ2PA" → "K7XM-Q2PA".
 * Input that is not a valid code is returned unchanged.
 */
export function formatInviteCode(code: string): string {
  const canonical = normalizeInviteCode(code);
  if (!canonical) return code;
  return `${canonical.slice(0, 4)}-${canonical.slice(4)}`;
}
