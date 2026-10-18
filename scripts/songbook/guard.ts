import { relative, resolve, sep } from "node:path";

import { isLocalHost, seedTargetHost } from "../../src/server/db/seed-target";

/**
 * Safety rails for the songbook importer (SPEC §4.8): these are not tests,
 * they keep private lyrics and production data safe.
 *
 *   * Never on Vercel (VERCEL or VERCEL_ENV set).
 *   * A database that is not on this machine needs --remote for ANY access,
 *     and --apply against it needs a human typing the club's name at an
 *     interactive terminal. Without a TTY the import refuses, so an AI agent
 *     can only ever import into a local database. The production import is
 *     run by Jesper himself.
 *   * The JSON report holds lyrics, so it may only be written under data/
 *     (git-ignored).
 *
 * Pure: everything it needs is passed in.
 */

export class GuardError extends Error {
  readonly exitCode = 2;
}

export type ImportTarget = {
  host: string;
  database: string;
  /** The URL with user and password masked, for printing. */
  display: string;
  local: boolean;
  /** --apply against a non-local host: the CLI must ask for the club name at the TTY. */
  needsConfirmation: boolean;
};

/** process.env or a test double; read: VERCEL, VERCEL_ENV, PGHOST, PGDATABASE. */
type GuardEnv = Readonly<Record<string, string | undefined>>;

export function maskDatabaseUrl(
  connectionString: string,
  env: GuardEnv = {},
): { display: string; database: string } {
  const host = seedTargetHost(connectionString, env);
  try {
    const url = new URL(connectionString);
    const database =
      decodeURIComponent(url.pathname.replace(/^\//, "")) || env.PGDATABASE || "(standard)";
    const port = url.port ? `:${url.port}` : "";
    return { display: `${url.protocol}//***@${host}${port}/${database}`, database };
  } catch {
    return { display: `(socket) ${host}`, database: env.PGDATABASE ?? "(standard)" };
  }
}

/**
 * Throws GuardError on Vercel. Shared with scripts/list-feedback.ts, which
 * passes its own name for the message.
 */
export function assertNotOnVercel(env: GuardEnv, scriptName = "Sangbogsimporten"): void {
  if (env.VERCEL || env.VERCEL_ENV) {
    throw new GuardError(`${scriptName} kører aldrig på Vercel (VERCEL eller VERCEL_ENV er sat).`);
  }
}

export function assertImportTarget(
  connectionString: string | undefined,
  env: GuardEnv,
  flags: { apply: boolean; remote: boolean; interactive: boolean },
): ImportTarget {
  assertNotOnVercel(env);
  if (!connectionString) {
    throw new GuardError("DATABASE_URL mangler. Sæt den i .env.local (se .env.example).");
  }
  const host = seedTargetHost(connectionString, env);
  const local = isLocalHost(host);
  const { display, database } = maskDatabaseUrl(connectionString, env);

  if (!local && !flags.remote) {
    throw new GuardError(
      `DATABASE_URL peger på "${host}", som ikke er en lokal database. ` +
        "Kun Jesper importerer til en fjern database: kør igen med --remote fra en terminal.",
    );
  }
  const needsConfirmation = !local && flags.apply;
  if (needsConfirmation && !flags.interactive) {
    throw new GuardError(
      `Import til "${host}" kræver, at du skriver klubbens navn i en interaktiv terminal. ` +
        "Ingen TTY: afbrudt.",
    );
  }
  return { host, database, display, local, needsConfirmation };
}

/** The report path must resolve under <projectRoot>/data/ (git-ignored); returns the absolute path. */
export function assertReportPath(path: string, projectRoot: string): string {
  const dataDir = resolve(projectRoot, "data");
  const target = resolve(projectRoot, path);
  const rel = relative(dataDir, target);
  if (
    rel === "" ||
    rel.startsWith("..") ||
    rel.startsWith(sep) ||
    resolve(dataDir, rel) !== target
  ) {
    throw new GuardError(`--report skal ligge under data/ (git-ignoreret), ikke "${path}".`);
  }
  return target;
}
