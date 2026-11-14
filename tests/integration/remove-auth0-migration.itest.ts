import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertItestDatabaseUrl, withDatabaseName } from "./env.mjs";
import {
  createScratchDatabase,
  dropScratchDatabase,
  migrationDirs,
  readMigration,
  withClient,
} from "./scratch-db";

/**
 * The remove-Auth0 migration (D-178) on a scratch database: every earlier
 * migration is applied, accounts are inserted as Auth0, Google and password
 * logins left them, and then the migration's SQL runs as `prisma migrate
 * deploy` would send it (scratch-db.ts explains why never the Prisma CLI).
 */

const itestUrl = assertItestDatabaseUrl(process.env.DATABASE_URL);
const SCRATCH_DB = "olklubben_rmauth0_itest";
const scratchUrl = withDatabaseName(itestUrl, SCRATCH_DB);
const maintenanceUrl = withDatabaseName(itestUrl, "postgres");

const dirs = migrationDirs();
const migrationIndex = dirs.findIndex((dir) => dir.endsWith("_remove_auth0_accounts"));

const users = {
  /** Auth0 linked onto a password account (Jesper's case). */
  both: randomUUID(),
  /** Only an Auth0 login. */
  auth0Only: randomUUID(),
  /** Google and a password: untouched. */
  google: randomUUID(),
};

type Counts = { users: number; byProvider: Record<string, number> };

async function counts(): Promise<Counts> {
  return withClient(scratchUrl, async (client) => {
    const userRows = await client.query<{ count: string }>("SELECT count(*) FROM users");
    const accountRows = await client.query<{ provider_id: string; count: string }>(
      "SELECT provider_id, count(*) FROM accounts GROUP BY provider_id",
    );
    return {
      users: Number(userRows.rows[0]?.count),
      byProvider: Object.fromEntries(
        accountRows.rows.map((row) => [row.provider_id, Number(row.count)]),
      ),
    };
  });
}

let before: Counts;

beforeAll(async () => {
  expect(migrationIndex, "migreringen findes").toBeGreaterThan(0);
  await createScratchDatabase(maintenanceUrl, SCRATCH_DB);
  await withClient(scratchUrl, async (client) => {
    for (const dir of dirs.slice(0, migrationIndex)) await client.query(readMigration(dir));
    await client.query(
      `INSERT INTO users (id, name, email, updated_at) VALUES
         ($1, 'Begge', 'begge@example.test', now()),
         ($2, 'Kun Auth0', 'kun-auth0@example.test', now()),
         ($3, 'Google', 'google@example.test', now())`,
      [users.both, users.auth0Only, users.google],
    );
    await client.query(
      `INSERT INTO accounts (id, account_id, provider_id, user_id, password, updated_at) VALUES
         (gen_random_uuid(), $1, 'credential', $1, 'hash', now()),
         (gen_random_uuid(), 'google-oauth2|1', 'auth0', $1, NULL, now()),
         (gen_random_uuid(), 'auth0|2', 'auth0', $2, NULL, now()),
         (gen_random_uuid(), $3, 'credential', $3, 'hash', now()),
         (gen_random_uuid(), 'google-sub-3', 'google', $3, NULL, now())`,
      [users.both, users.auth0Only, users.google],
    );
  });
  before = await counts();
  await withClient(scratchUrl, (client) => client.query(readMigration(dirs[migrationIndex]!)));
});

afterAll(async () => {
  await dropScratchDatabase(maintenanceUrl, SCRATCH_DB);
});

describe("remove_auth0_accounts (D-178)", () => {
  it("deletes every Auth0 login", async () => {
    expect(before.byProvider.auth0).toBe(2);
    expect((await counts()).byProvider.auth0).toBeUndefined();
  });

  it("keeps the users, their passwords and their Google logins", async () => {
    const after = await counts();
    expect(after.users).toBe(before.users);
    expect(after.byProvider.credential).toBe(before.byProvider.credential);
    expect(after.byProvider.google).toBe(before.byProvider.google);
  });
});
