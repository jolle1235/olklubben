/**
 * Environment for the Vitest integration tests (`npm run test:integration`).
 *
 * Imported by vitest.integration.config.mts and global-setup.ts (both run in
 * Vitest's main process). The test workers inherit the main process's env and
 * get `itestEnv` on top through `test.env`.
 *
 * The tests write to a dedicated database whose name must end in "_itest"
 * (olklubben_itest). Never olklubben_dev (your data) and never olklubben_test
 * (the E2E server may be using it at the same time).
 *
 *   ITEST_DATABASE_URL  if set, else .env.test's DATABASE_URL with the database
 *                       name replaced by "olklubben_itest".
 */
import { createRequire } from "node:module";

// @next/env is CommonJS without named-export hints: Node's ESM loader (which
// loads the bundled vitest.integration.config.mts) cannot import it by name.
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");

export const ITEST_DATABASE_NAME = "olklubben_itest";

/** The database name in a postgres:// URL ("" if it has none). */
export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/**
 * Throws (in Danish) unless the URL points at a database whose name ends in
 * "_itest". Runs before any connection is opened.
 */
export function assertItestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("Integrationstests: ingen database-URL (ITEST_DATABASE_URL/DATABASE_URL).");
  }
  let name: string;
  try {
    name = databaseName(url);
  } catch {
    throw new Error("Integrationstests: database-URL'en er ikke en gyldig postgresql://-URL.");
  }
  if (!name.endsWith("_itest")) {
    throw new Error(
      `Integrationstests: databasen "${name}" er afvist. Integrationstests må kun køre mod en ` +
        `database, hvis navn ender på "_itest" (fx ${ITEST_DATABASE_NAME}), aldrig mod ` +
        `udviklings- (_dev) eller E2E-databasen (_test), fordi de tømmes før hver kørsel.`,
    );
  }
  return url;
}

/** The URL with its database name replaced (the path of a postgres:// URL). */
export function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export type ItestEnv = {
  NODE_ENV: "test";
  DATABASE_URL: string;
  DIRECT_URL: string;
  RATE_LIMIT_DISABLED: "1";
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Integrationstests: ${name} mangler. Den sættes i .env.test.`);
  return value;
}

/**
 * Loads .env.test (NODE_ENV=test: @next/env never reads .env.local), guards
 * the database name and returns the overrides for the test workers. Also
 * applies them to this process (for `prisma migrate deploy` and the global
 * setup) and removes DATABASE_URL_UNPOOLED, so nothing can fall back to
 * another database (src/lib/migration-url.ts).
 */
export function loadItestEnv(): ItestEnv {
  Object.assign(process.env, { NODE_ENV: "test" });
  loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

  const databaseUrl = assertItestDatabaseUrl(
    process.env.ITEST_DATABASE_URL ||
      withDatabaseName(required("DATABASE_URL"), ITEST_DATABASE_NAME),
  );

  const itestEnv: ItestEnv = {
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    RATE_LIMIT_DISABLED: "1",
    BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  };

  Object.assign(process.env, itestEnv);
  delete process.env.DATABASE_URL_UNPOOLED;
  return itestEnv;
}
