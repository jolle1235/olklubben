/**
 * Initials for avatars and club badges: the first letter of the first and the
 * last word ("Jesper Holm Hansen" → "JH", "Mads" → "M"). Words without a letter
 * or digit ("&", "–") are skipped. Returns "?" when nothing usable is left.
 */
export function getInitials(name: string, max: 1 | 2 = 2): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((letter): letter is string => Boolean(letter));

  const first = words[0];
  if (!first) return "?";

  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letters = max === 2 && last ? first + last : first;
  return letters.toLocaleUpperCase("da-DK");
}

/** Deterministic pick from a list, so a name always gets the same color. */
export function pickByName<T>(name: string, options: readonly [T, ...T[]]): T {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return options[hash % options.length] ?? options[0];
}
