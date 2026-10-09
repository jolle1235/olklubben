import { execFileSync } from "node:child_process";
import path from "node:path";

import { Client } from "pg";

import { pgConfig } from "../../src/server/db/pg-config";
import { truncateAppTables } from "../support/truncate-app-tables";
import { databaseName, loadItestEnv, withDatabaseName } from "./env.mjs";

/**
 * Runs once in Vitest's main process before the integration tests:
 *
 * 1. Creates the itest database if it does not exist (via the maintenance DB
 *    "postgres" on the same server).
 * 2. Applies the migrations with `prisma migrate deploy` (never migrate reset).
 * 3. Empties every application table, so each run starts from a clean slate.
 *
 * The returned teardown empties the tables again, so no test users are left.
 * loadItestEnv() has already refused any database not ending in "_itest".
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const itestEnv = loadItestEnv();
  const url = itestEnv.DATABASE_URL;

  await ensureDatabase(url);

  const env: NodeJS.ProcessEnv = { ...process.env, ...itestEnv };
  delete env.DATABASE_URL_UNPOOLED;
  execFileSync(path.join("node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
    stdio: ["ignore", "ignore", "inherit"],
    env,
  });

  await emptyDatabase(url);
  return () => emptyDatabase(url);
}

async function ensureDatabase(url: string): Promise<void> {
  const name = databaseName(url);
  const client = new Client(pgConfig(withDatabaseName(url, "postgres")));
  try {
    await client.connect();
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) {
      // UTF8 like olklubben_dev/_test (README), whatever the server's default
      // encoding is: character-length CHECKs and æ/ø/å behave as in production.
      await client.query(
        `CREATE DATABASE "${name.replaceAll('"', '""')}" TEMPLATE template0 ENCODING 'UTF8'`,
      );
    }
  } catch (error) {
    throw new Error(
      `Integrationstests: kunne ikke finde eller oprette databasen "${name}" ` +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        `Opret den selv, og kør testene igen:\n` +
        `  psql -h localhost -U postgres -c "CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8'"`,
      { cause: error },
    );
  } finally {
    await client.end().catch(() => {});
  }
}

async function emptyDatabase(url: string): Promise<void> {
  const client = new Client(pgConfig(url));
  await client.connect();
  try {
    await truncateAppTables(client);
  } finally {
    await client.end();
  }
}
