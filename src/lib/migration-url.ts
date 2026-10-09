/**
 * Which database URL the Prisma CLI migrates (SPEC §4.8, prisma.config.ts).
 *
 * Pure module without alias imports or `server-only`: prisma.config.ts and the
 * E2E/integration test setup import it by relative path.
 *
 *   1. DIRECT_URL             – local/manual use only (never set it on Vercel)
 *   2. DATABASE_URL_UNPOOLED  – set by Vercel's Neon integration, per environment
 *                               and, with preview branching, per Preview deployment
 *   3. DATABASE_URL           – locally the same database as the app
 *
 * Why not DIRECT_URL on Vercel: a variable set by hand in the Vercel project is
 * the same for every Preview deployment, so a Preview build would run
 * `prisma migrate deploy` against that one database – typically production.
 * The integration's DATABASE_URL_UNPOOLED points at the Neon branch that
 * belongs to the deployment.
 */

/** process.env, or the relevant subset of it (DIRECT_URL, DATABASE_URL_UNPOOLED, DATABASE_URL, VERCEL, VERCEL_ENV). */
export type MigrationEnv = Readonly<Record<string, string | undefined>>;

/** The URL migrations run against: DIRECT_URL, else DATABASE_URL_UNPOOLED, else DATABASE_URL. */
export function resolveMigrationUrl(env: MigrationEnv = process.env): string | undefined {
  return env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
}

/**
 * Guards for builds on Vercel (VERCEL is set). Does nothing elsewhere, so local
 * development and a fresh clone without env files are unaffected.
 *
 * - A Preview deployment must never use DIRECT_URL: it would migrate whatever
 *   database it points at (production) instead of the Preview's Neon branch.
 * - Migrations need a direct connection: Neon's pooled host ("-pooler",
 *   PgBouncer in transaction mode) cannot hold the migration lock reliably.
 *
 * Also runs during `prisma generate` (postinstall), so a misconfigured project
 * fails at install time, before anything is migrated.
 */
export function assertMigrationUrlSafe(env: MigrationEnv = process.env): void {
  if (!env.VERCEL) return;

  if (env.VERCEL_ENV === "preview" && env.DIRECT_URL) {
    throw new Error(
      "DIRECT_URL må ikke sættes for Preview – migrations bruger Neon-branchens DATABASE_URL_UNPOOLED. " +
        "Fjern DIRECT_URL fra Vercel-projektets miljøvariabler (README: Deploy til Vercel + Neon).",
    );
  }

  const url = resolveMigrationUrl(env);
  if (url && migrationHostname(url).includes("-pooler")) {
    throw new Error(
      'Migrations må ikke køre over Neons pooled forbindelse (host med "-pooler"). ' +
        "Tjek, at Neon-integrationen sætter DATABASE_URL_UNPOOLED for dette miljø.",
    );
  }
}

function migrationHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
