/**
 * Guard for prisma/seed.ts: test users with a documented password must never
 * end up in production, or by accident in any non-local database.
 *
 * Pure module without `server-only` (imported by the tsx seed script).
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * True for a host on this machine (as seedTargetHost returns it). Shared with
 * the songbook importer's guard (scripts/songbook/guard.ts): only a local
 * database may be written without a human confirming at a terminal.
 */
export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host);
}

type SeedEnv = Partial<
  Record<"NODE_ENV" | "VERCEL_ENV" | "SEED_ALLOW_REMOTE" | "PGHOST", string | undefined>
>;

/**
 * The host node-postgres will connect to: a `host` query parameter wins over
 * the URL's host (pg-connection-string), an empty host falls back to PGHOST or
 * localhost, and a Unix socket path is local.
 */
export function seedTargetHost(connectionString: string, env: SeedEnv = process.env): string {
  if (connectionString.startsWith("/")) return "localhost";
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return "(ugyldig DATABASE_URL)";
  }
  const host = url.searchParams.get("host") || url.hostname || env.PGHOST || "localhost";
  return host.startsWith("/") ? "localhost" : host;
}

/**
 * Throws (in Danish) before the seed connects when the target is production or
 * not a local database. A Neon dev branch can be seeded with SEED_ALLOW_REMOTE=1.
 * The database name is not checked: every Neon branch is called "neondb".
 */
export function assertSeedTarget(connectionString: string, env: SeedEnv = process.env): void {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error(
      'Seed-scriptet kører aldrig i produktion (NODE_ENV eller VERCEL_ENV er "production"). ' +
        "Testbrugerne har et kendt password.",
    );
  }

  const host = seedTargetHost(connectionString, env);
  if (isLocalHost(host) || env.SEED_ALLOW_REMOTE === "1") return;

  throw new Error(
    `Seed-scriptet skriver kun testdata til en lokal database, men DATABASE_URL peger på "${host}". ` +
      "Er det en Neon dev-branch (aldrig produktion), så kør igen med SEED_ALLOW_REMOTE=1.",
  );
}
