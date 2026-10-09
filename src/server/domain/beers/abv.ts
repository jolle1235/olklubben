/**
 * Alcohol by volume (SPEC §9.5): 0,0–99,9 % with one decimal. Stored as
 * Decimal(3,1) (CHECK abv >= 0 AND abv < 100).
 *
 * Input [BESLUTNING]: accepts a comma or a dot ("5,2", "5.2"), surrounding
 * spaces and a trailing "%" ("5,2 %"). At most one decimal: "5,25" is refused
 * with a message, never silently rounded, because the label is what the member
 * typed. Trailing zeros are fine ("5,20" = 5,2).
 *
 * DoS guard: the field is parsed before the session check (SPEC §4.3), so the
 * trimmed input is capped at ABV_INPUT_MAX_LENGTH characters before any
 * parsing, and a longer value is a "format" error. The parser itself uses no
 * regex that can backtrack quadratically.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const ABV_MIN = 0;
export const ABV_MAX = 99.9;
/** "99,9 %" is 6 characters; anything beyond this is not an ABV. */
export const ABV_INPUT_MAX_LENGTH = 16;

export type AbvParseResult =
  { ok: true; value: number } | { ok: false; reason: "empty" | "format" | "range" | "precision" };

const ABV_PATTERN = /^(\d+)(?:[.,](\d+))?$/;

/** Parses user input into a number with at most one decimal, or a reason why not. */
export function parseAbvInput(input: unknown): AbvParseResult {
  if (typeof input === "number") return parseAbvInput(String(input));
  if (typeof input !== "string") return { ok: false, reason: "empty" };

  const trimmed = input.trim();
  if (trimmed.length > ABV_INPUT_MAX_LENGTH) return { ok: false, reason: "format" };

  let text = trimmed;
  if (text.endsWith("%")) text = text.slice(0, -1).trimEnd();
  if (text === "") return { ok: false, reason: "empty" };

  const match = ABV_PATTERN.exec(text);
  if (!match) return { ok: false, reason: "format" };

  const whole = match[1] ?? "0";
  let decimals = match[2] ?? "";
  while (decimals.endsWith("0")) decimals = decimals.slice(0, -1);
  if (decimals.length > 1) return { ok: false, reason: "precision" };

  // Tenths as an integer, so 5,2 is exactly 52/10 (no float arithmetic on input).
  const tenths = Number(whole) * 10 + Number(decimals || "0");
  if (!Number.isSafeInteger(tenths) || tenths > ABV_MAX * 10) {
    return { ok: false, reason: "range" };
  }
  return { ok: true, value: tenths / 10 };
}

/** The ABV as a number with one decimal, or null when the input is not valid. */
export function parseAbv(input: unknown): number | null {
  const result = parseAbvInput(input);
  return result.ok ? result.value : null;
}

/** Danish messages for the form (used by src/lib/validation/beer.ts). */
export const ABV_ERROR_MESSAGES: Record<Exclude<AbvParseResult, { ok: true }>["reason"], string> = {
  empty: "Skriv alkoholprocenten, fx 5,2.",
  format: "Skriv alkoholprocenten som et tal, fx 5,2.",
  range: "Alkoholprocenten skal være mellem 0 og 99,9.",
  precision: "Brug højst én decimal, fx 5,2.",
};

/**
 * "5,2 %" with a non-breaking space before "%", so the two never wrap apart
 * (Playwright's text matching treats it as a normal space). Accepts a number
 * or a Decimal-like value from Prisma ("5.2", Decimal).
 */
export function formatAbv(value: number | string | { toString(): string }): string {
  const number = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(number)) return "";
  return `${number.toFixed(1).replace(".", ",")} %`;
}

/** The value for an input field when editing: 5.2 → "5,2". */
export function abvToInputValue(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1).replace(".", ",") : "";
}
