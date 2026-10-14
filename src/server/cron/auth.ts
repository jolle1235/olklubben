import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Authorizes a Vercel Cron call (SPEC §4.8, D-131): Vercel sends
 * "Authorization: Bearer <CRON_SECRET>". Both sides are hashed with SHA-256
 * first, so the comparison is constant-time AND of equal length whatever the
 * caller sends (timingSafeEqual throws on different lengths). Only the exact
 * header "Bearer <secret>" passes; another scheme, extra spaces or a missing
 * header do not. An empty secret never authorizes anything.
 */
export function isCronAuthorized(header: string | null, secret: string): boolean {
  if (secret === "") return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const actual = createHash("sha256")
    .update(header ?? "")
    .digest();
  return timingSafeEqual(expected, actual);
}
