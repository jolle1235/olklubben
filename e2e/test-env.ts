/**
 * Environment for E2E tests. Imported by playwright.config.ts (main process and
 * workers) and by the global setup, so everything runs against the test DB.
 *
 * NODE_ENV=test makes @next/env (and therefore Next.js, prisma.config.ts and
 * this file) load .env.test.local, .env.test and .env, but never .env.local.
 * Variables already set in the shell/CI win over the files.
 */
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { resolveMigrationUrl } from "../src/lib/migration-url";

Object.assign(process.env, { NODE_ENV: "test" });
loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

/** Throws unless the URL points at a database whose name ends in "_test". */
function assertTestDatabase(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`E2E: ${name} mangler. Den sættes i .env.test.`);
  }
  const database = new URL(value).pathname.replace(/^\//, "");
  if (!database.endsWith("_test")) {
    throw new Error(
      `E2E: ${name} peger på databasen "${database}". E2E-tests må kun køre mod en ` +
        `database, hvis navn ender på "_test" (fx olklubben_test), så udviklingsdata ` +
        `aldrig bliver rørt.`,
    );
  }
  return value;
}

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const testDatabaseUrl = assertTestDatabase("DATABASE_URL", process.env.DATABASE_URL);
// Prisma migrates DIRECT_URL, else DATABASE_URL_UNPOOLED, else DATABASE_URL
// (prisma.config.ts → resolveMigrationUrl), so guard that URL too.
export const testDirectUrl = assertTestDatabase(
  "DIRECT_URL/DATABASE_URL_UNPOOLED",
  resolveMigrationUrl(),
);

/**
 * Absolute path of the dev outbox the E2E server writes emails to (D-024):
 * DEV_OUTBOX_DIR from .env.test, resolved like src/server/email/send-email.ts
 * does (from the project root, where both Playwright and the server run).
 * Emails are written after the HTTP response, so tests must poll for them.
 */
export const e2eOutboxDir = path.resolve(
  process.cwd(),
  process.env.DEV_OUTBOX_DIR || ".dev-outbox",
);

if (process.env.BETTER_AUTH_URL !== E2E_BASE_URL) {
  throw new Error(
    `E2E: BETTER_AUTH_URL skal være ${E2E_BASE_URL} (er "${process.env.BETTER_AUTH_URL}").`,
  );
}
