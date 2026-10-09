import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";

import { assertItestDatabaseUrl } from "./env.mjs";

// Defence in depth: never count against another database.
assertItestDatabaseUrl(process.env.DATABASE_URL);

/**
 * The real database rate limiter (src/server/rate-limit.ts, SPEC §4.7–4.8):
 * one atomic INSERT … ON CONFLICT per call against app_rate_limits.
 *
 * The integration env sets RATE_LIMIT_DISABLED=1 (like E2E); this file turns
 * the limiter back on.
 */
vi.mock("@/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/env")>()),
  isRateLimitDisabled: false,
}));

const WINDOW_SECONDS = 600;

function uniqueKey(): string {
  return `itest:rate-limit:${randomUUID()}`;
}

async function hit(key: string, limit: number) {
  return rateLimit(key, { limit, windowSeconds: WINDOW_SECONDS });
}

describe("rateLimit mod databasen", () => {
  it("tillader limit kald og afviser det næste med en ventetid inden for vinduet", async () => {
    const key = uniqueKey();
    for (let count = 1; count <= 3; count += 1) {
      expect(await hit(key, 3)).toEqual({ ok: true });
    }

    const limited = await hit(key, 3);

    expect(limited.ok).toBe(false);
    if (limited.ok) return;
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
    expect(limited.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_SECONDS);
    const row = await db.appRateLimit.findUniqueOrThrow({ where: { key } });
    expect(row.count).toBe(4);
  });

  it("starter et nyt vindue, når det gamle er udløbet", async () => {
    const key = uniqueKey();
    await hit(key, 1);
    expect((await hit(key, 1)).ok).toBe(false);

    await db.$executeRaw`
      UPDATE app_rate_limits SET expires_at = now() - interval '1 second' WHERE key = ${key}
    `;

    expect(await hit(key, 1)).toEqual({ ok: true });
    const row = await db.appRateLimit.findUniqueOrThrow({ where: { key } });
    expect(row.count).toBe(1);
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("forskellige nøgler tæller hver for sig", async () => {
    const first = uniqueKey();
    const second = uniqueKey();
    await hit(first, 1);
    expect((await hit(first, 1)).ok).toBe(false);

    expect(await hit(second, 1)).toEqual({ ok: true });
  });
});
