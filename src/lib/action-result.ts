import type { ZodError } from "zod";

/**
 * The uniform result of every Server Action (SPEC §4.3):
 *
 *   { ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }
 *
 * `message` is Danish and safe to show to the user. `fieldErrors` maps a form
 * field name to its Danish error messages (from the shared Zod schema).
 *
 * Note: "not logged in" and "not a member" are not results – the action calls
 * requireUser()/requireMembership(), which redirect or render 404.
 *
 * Client-safe: no server-only imports.
 */

export type FieldErrors = Record<string, string[]>;

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

/** Common error codes. Feature code may add its own (UPPER_SNAKE_CASE). */
export const ACTION_ERROR_CODES = {
  VALIDATION: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  UNEXPECTED: "UNEXPECTED_ERROR",
} as const;

export const DEFAULT_ERROR_MESSAGES = {
  VALIDATION: "Tjek felterne og prøv igen.",
  FORBIDDEN: "Det har du ikke adgang til.",
  RATE_LIMITED: "For mange forsøg. Vent lidt, og prøv igen.",
  // SPEC §13.5 "Generisk fejl".
  UNEXPECTED: "Noget gik galt – prøv igen. Vi har tørret disken af.",
} as const;

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
): { ok: false; error: ActionError } {
  return { ok: false, error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
}

/** Turns a failed Zod parse into a VALIDATION_ERROR result with per-field messages. */
export function validationError(
  error: ZodError,
  message: string = DEFAULT_ERROR_MESSAGES.VALIDATION,
): { ok: false; error: ActionError } {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fail(ACTION_ERROR_CODES.VALIDATION, message, fieldErrors);
}

/** Rate limited (e.g. join-with-code). `retryAfterSeconds` is mentioned in the message. */
export function rateLimitedError(retryAfterSeconds?: number): { ok: false; error: ActionError } {
  const message =
    retryAfterSeconds && retryAfterSeconds > 0
      ? `For mange forsøg. Prøv igen om ${formatWait(retryAfterSeconds)}.`
      : DEFAULT_ERROR_MESSAGES.RATE_LIMITED;
  return fail(ACTION_ERROR_CODES.RATE_LIMITED, message);
}

export function unexpectedError(message: string = DEFAULT_ERROR_MESSAGES.UNEXPECTED): {
  ok: false;
  error: ActionError;
} {
  return fail(ACTION_ERROR_CODES.UNEXPECTED, message);
}

/** "1 sekund", "45 sekunder", "1 minut", "3 minutter" (rounded up to whole minutes from 60 s). */
export function formatWait(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? "1 sekund" : `${seconds} sekunder`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minut" : `${minutes} minutter`;
}
