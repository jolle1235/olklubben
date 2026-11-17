import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

import { pgConfig } from "@/server/db/pg-config";

/**
 * Helpers for migration tests on a scratch database (*-migration.itest.ts):
 * run SQL on a connection, create and drop the scratch database,
 * and read the migrations as `prisma migrate deploy` would send them. Never the
 * Prisma CLI from the repo root: .env.local's DIRECT_URL would win.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/** The migration directories, oldest first. */
export function migrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function readMigration(dir: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
}

export async function withClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(pgConfig(url));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function assertScratch(name: string): void {
  if (!name.endsWith("_itest")) throw new Error(`Rører kun *_itest-databaser, ikke "${name}".`);
}

/** Drops `name` through the maintenance database; only ever a scratch "*_itest" database. */
export async function dropScratchDatabase(maintenanceUrl: string, name: string): Promise<void> {
  assertScratch(name);
  await withClient(maintenanceUrl, (client) =>
    client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
  );
}

/**
 * A fresh, empty scratch database (dropped first if it exists), C.UTF-8 like
 * olklubben_dev/_test and Neon: lower() follows LC_CTYPE (TG-036).
 */
export async function createScratchDatabase(maintenanceUrl: string, name: string): Promise<void> {
  await dropScratchDatabase(maintenanceUrl, name);
  await withClient(maintenanceUrl, (client) =>
    client.query(
      `CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8' ` +
        `LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8'`,
    ),
  );
}
