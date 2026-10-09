import "server-only";

import { isRateLimitDisabled } from "@/env";
import { db } from "@/server/db";

/**
 * Database-backed fixed-window rate limiter (SPEC §4.7, §4.8). Serverless
 * functions share no memory, so the counters live in Postgres
 * (app_rate_limits).
 *
 * One SQL statement per call (INSERT … ON CONFLICT DO UPDATE … RETURNING), so
 * concurrent requests can never both slip under the limit.
 *
 * Usage (e.g. join-with-code, keyed per user):
 *
 *   const limited = await rateLimit(`join:user:${user.id}`, { limit: 10, windowSeconds: 600 });
 *   if (!limited.ok) return rateLimitedError(limited.retryAfterSeconds);
 *
 * Keys are free text; prefix them with the feature ("join:", "auth:") so
 * features never share a counter. Do not put raw emails in keys (use
 * hashRateLimitPart()).
 *
 * With RATE_LIMIT_DISABLED=1 (development/test only, set in .env.test for
 * E2E) every call is allowed and nothing is written.
 */

export type RateLimitOptions = {
  /** Allowed requests per window (≥ 1). */
  limit: number;
  /** Window length in seconds (≥ 1). The window starts with the first request. */
  windowSeconds: number;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Rows whose window ended this long ago are deleted now and then. */
const PRUNE_AFTER_SECONDS = 24 * 60 * 60;
const PRUNE_PROBABILITY = 0.02;

export async function rateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const { limit, windowSeconds } = options;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`rateLimit: limit skal være et heltal ≥ 1 (fik ${limit}).`);
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new RangeError(
      `rateLimit: windowSeconds skal være et heltal ≥ 1 (fik ${windowSeconds}).`,
    );
  }
  if (key.length === 0) {
    throw new RangeError("rateLimit: key må ikke være tom.");
  }

  if (isRateLimitDisabled) return { ok: true };

  const rows = await db.$queryRaw<{ count: number; retry_after: number }[]>`
    INSERT INTO app_rate_limits (key, count, expires_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN app_rate_limits.expires_at <= now() THEN 1
        ELSE app_rate_limits.count + 1
      END,
      expires_at = CASE
        WHEN app_rate_limits.expires_at <= now() THEN EXCLUDED.expires_at
        ELSE app_rate_limits.expires_at
      END
    RETURNING
      count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::int AS retry_after
  `;

  if (Math.random() < PRUNE_PROBABILITY) {
    await pruneExpired();
  }

  const row = rows[0];
  if (!row) throw new Error("rateLimit: databasen returnerede ingen række.");
  if (row.count <= limit) return { ok: true };
  return { ok: false, retryAfterSeconds: row.retry_after };
}

async function pruneExpired(): Promise<void> {
  try {
    await db.$executeRaw`
      DELETE FROM app_rate_limits
      WHERE expires_at < now() - make_interval(secs => ${PRUNE_AFTER_SECONDS})
    `;
  } catch (error) {
    // Pruning is housekeeping; a failure must not fail the request.
    console.error("[rate-limit] Kunne ikke rydde gamle rækker op", error);
  }
}

/**
 * Turns a sensitive key part (an email) into a short, stable hash, so the
 * table never holds personal data: `auth:reset:email:${await hashRateLimitPart(email)}`.
 */
export async function hashRateLimitPart(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("base64url").slice(0, 22);
}
