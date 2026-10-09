import type { Client } from "pg";

/**
 * Empties every table in the public schema except Prisma's migration history,
 * so a test run starts from a clean slate with the schema intact. Used by the
 * E2E and integration global setups, only ever against a test database (the
 * callers guard the name: "_test" / "_itest").
 */
export async function truncateAppTables(client: Client): Promise<void> {
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  const tables = rows
    .map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
    .join(", ");
  await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
