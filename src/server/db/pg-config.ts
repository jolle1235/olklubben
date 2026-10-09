/**
 * node-postgres connection settings shared by every database connection we
 * open: the app (src/server/db), the seed (prisma/seed.ts) and the E2E helpers
 * (e2e/support/db.ts, e2e/global-setup.ts). See SPEC §19.4 F-012.
 *
 * Pure module without `server-only`, so tsx scripts and Playwright can import
 * it by relative path.
 *
 * Why UTC: @prisma/adapter-pg sends Date parameters as UTC wall-clock time
 * without an offset and reads timestamptz values back as if they were UTC. In a
 * session with another TimeZone (e.g. Europe/Copenhagen, the default of many
 * local Postgres installations) every timestamp Prisma writes is stored shifted
 * by the UTC offset, so SQL against now(), psql and Prisma Studio are wrong.
 * Setting TimeZone=UTC per connection makes this independent of the database's
 * own setting – no ALTER DATABASE needed.
 */

/** Postgres startup option that runs the session in UTC. */
export const PG_UTC_OPTIONS = "-c TimeZone=UTC";

export type PgConnectionConfig = { connectionString: string; options?: string };

/**
 * `{ connectionString, options: "-c TimeZone=UTC" }` for `new pg.Client()`,
 * `new pg.Pool()` or `new PrismaPg()`. node-postgres sends `options` as a
 * startup parameter.
 *
 * - Neon's pooled hosts ("-pooler", PgBouncer in transaction mode) may reject
 *   or ignore unknown startup parameters, and Neon computes already run in
 *   UTC/GMT (checked in the README deploy checklist), so they get no option.
 * - An `options` query parameter in the URL is merged into the config value and
 *   removed from the URL: node-postgres lets the parsed URL override the config,
 *   which would drop our option. Ours comes last, so TimeZone=UTC always wins.
 */
export function pgConfig(connectionString: string): PgConnectionConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Not a URL (e.g. a Unix socket path): always a local database.
    return { connectionString, options: PG_UTC_OPTIONS };
  }

  if (url.hostname.includes("-pooler")) return { connectionString };

  const existing = url.searchParams.get("options")?.trim();
  if (existing === undefined) return { connectionString, options: PG_UTC_OPTIONS };

  url.searchParams.delete("options");
  return {
    connectionString: url.toString(),
    options: existing ? `${existing} ${PG_UTC_OPTIONS}` : PG_UTC_OPTIONS,
  };
}
