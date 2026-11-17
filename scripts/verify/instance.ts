import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { Client } from "pg";

import { pgConfig } from "../../src/server/db/pg-config";
import { isLocalHost, seedTargetHost } from "../../src/server/db/seed-target";

/**
 * What every verify command shares: where an instance lives, its recorded
 * state, its database and the environment its server runs with.
 *
 * An instance is a git worktree outside the repository (VERIFY_HOME/<id>/app),
 * with hard-linked node_modules, its own Postgres database and its own port.
 * Outside the repository so `next dev` can rewrite the copy's tsconfig.json and
 * Turbopack sees node_modules inside its root (a symlink out of the root fails).
 */

export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** Instances: $VERIFY_HOME, default ~/.cache/olklubben-verify. */
const VERIFY_HOME = path.resolve(
  process.env.VERIFY_HOME || path.join(os.homedir(), ".cache", "olklubben-verify"),
);

/** Screenshots, the server log copied by `down`: kept after `down`, gitignored. */
export function evidenceDir(id: string): string {
  return path.join(REPO_ROOT, ".flow", "verify", id);
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function assertId(id: string | undefined): string {
  if (!id || !ID_PATTERN.test(id)) {
    throw new Error(`Ugyldigt id "${id ?? ""}": brug a-z, 0-9 og "-" (højst 40 tegn).`);
  }
  return id;
}

export function instanceDir(id: string): string {
  return path.join(VERIFY_HOME, id);
}

export function appDir(id: string): string {
  return path.join(instanceDir(id), "app");
}

export function serverLogPath(id: string): string {
  return path.join(instanceDir(id), "server.log");
}

// ─── State ──────────────────────────────────────────────────────────────────

export type InstanceState = {
  id: string;
  /** Commit the worktree was created from; `--ref` or HEAD. */
  sha: string;
  /** False: the working tree's changes are synced on top of `sha` (and again on every `up`). */
  pinned: boolean;
  port: number;
  url: string;
  database: string;
  databaseUrl: string;
  pid: number;
  cronSecret: string;
  markerEmail: string;
  startedAt: string;
  /** Started with `--google`: fake Google credentials, so the Google button and its redirect show. Absent in older state files. */
  google?: boolean;
  /** Set when `up` finished (marker user created, pages warmed); only then is the instance reused. */
  readyAt?: string;
};

function statePath(id: string): string {
  return path.join(instanceDir(id), "state.json");
}

export function readState(id: string): InstanceState | null {
  const file = statePath(id);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as InstanceState;
}

export function writeState(state: InstanceState): void {
  mkdirSync(instanceDir(state.id), { recursive: true });
  writeFileSync(statePath(state.id), `${JSON.stringify(state, null, 2)}\n`);
}

/** Ids with a directory under VERIFY_HOME (running or not). */
export function listInstanceIds(): string[] {
  if (!existsSync(VERIFY_HOME)) return [];
  return readdirSync(VERIFY_HOME, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

// ─── Ports ──────────────────────────────────────────────────────────────────

/** One file per claimed port, holding the owner's id. A dot dir, so it is never an instance id. */
const PORTS_DIR = path.join(VERIFY_HOME, ".ports");

/**
 * Claims `port` for `id` atomically (exclusive create), so two `up`s started
 * at the same moment never pick the same port. A claim whose owner has no
 * instance directory any more is stale and taken over.
 */
export function claimPort(port: number, id: string): boolean {
  mkdirSync(PORTS_DIR, { recursive: true });
  const file = path.join(PORTS_DIR, String(port));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(file, id, { flag: "wx" });
      return true;
    } catch {
      const owner = readFileSync(file, "utf8");
      if (owner === id) return true;
      if (existsSync(instanceDir(owner))) return false;
      rmSync(file, { force: true });
    }
  }
  return false;
}

/** Releases every port `id` claimed. */
export function releasePorts(id: string): void {
  if (!existsSync(PORTS_DIR)) return;
  for (const name of readdirSync(PORTS_DIR)) {
    const file = path.join(PORTS_DIR, name);
    if (readFileSync(file, "utf8") === id) rmSync(file, { force: true });
  }
}

// ─── Process ────────────────────────────────────────────────────────────────

/** True when `pid` is alive, runs `next dev` and its working directory is the instance's app. */
export function isOurServer(state: InstanceState): boolean {
  try {
    const cwd = execFileSync("readlink", [`/proc/${state.pid}/cwd`], { encoding: "utf8" }).trim();
    const cmdline = readFileSync(`/proc/${state.pid}/cmdline`, "utf8").split("\0");
    return cwd === appDir(state.id) && cmdline.some((arg) => arg.endsWith("next/dist/bin/next"));
  } catch {
    return false;
  }
}

/** The environment the process was started with (/proc/<pid>/environ). */
export function processEnv(pid: number): Record<string, string> {
  const env: Record<string, string> = {};
  for (const entry of readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")) {
    const at = entry.indexOf("=");
    if (at > 0) env[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return env;
}

// ─── Database ───────────────────────────────────────────────────────────────

/** Admin connection for CREATE/DROP DATABASE; $VERIFY_PG_URL, local only. */
const ADMIN_URL = process.env.VERIFY_PG_URL || "postgresql://postgres@localhost:5432/postgres";

export const DATABASE_PREFIX = "olklubben_verify_";

export function databaseName(id: string): string {
  return `${DATABASE_PREFIX}${id.replaceAll("-", "_")}`;
}

export function databaseUrl(database: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

function assertLocalAdmin(): void {
  const host = seedTargetHost(ADMIN_URL);
  if (!isLocalHost(host)) {
    throw new Error(`VERIFY_PG_URL skal pege på en lokal Postgres (peger på "${host}").`);
  }
}

async function withAdmin<T>(run: (client: Client) => Promise<T>): Promise<T> {
  assertLocalAdmin();
  const client = new Client(pgConfig(ADMIN_URL));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function assertVerifyDatabase(database: string): void {
  if (!database.startsWith(DATABASE_PREFIX) || !/^[a-z0-9_]+$/.test(database)) {
    throw new Error(`Rører kun verify-databaser (${DATABASE_PREFIX}*), ikke "${database}".`);
  }
}

/** Drops (if it exists) and creates the instance's database. */
export async function recreateDatabase(database: string): Promise<void> {
  assertVerifyDatabase(database);
  await withAdmin(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${database}"`);
  });
}

export async function dropDatabase(database: string): Promise<void> {
  assertVerifyDatabase(database);
  await withAdmin((client) => client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`));
}

/** Runs one query against the instance's own database. */
export async function queryInstance<T extends object>(
  state: Pick<InstanceState, "databaseUrl">,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client(pgConfig(state.databaseUrl));
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

// ─── Environment ────────────────────────────────────────────────────────────

/** The client id `--google` instances send to Google; visible as client_id in the captured redirect. */
const FAKE_GOOGLE_CLIENT_ID = "verify-fake.apps.googleusercontent.com";

/**
 * The complete environment of the instance's server, migrate and seed. Every
 * variable the app reads (src/lib/env-schema.ts) is set here, and the copy has
 * no .env files, so nothing from .env.local or a shell export leaks in.
 * NODE_ENV=test as in the E2E server (emails go to the outbox, D-024).
 */
export function instanceEnv(options: {
  database: string;
  port: number;
  authSecret: string;
  cronSecret: string;
  outboxDir: string;
  /** Fake Google credentials (`--google`): enough for the button and the redirect to Google, never a real login. */
  google: boolean;
}): NodeJS.ProcessEnv {
  const url = databaseUrl(options.database);
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: "C.UTF-8",
    TZ: "Europe/Copenhagen",
    NODE_ENV: "test",
    NEXT_TELEMETRY_DISABLED: "1",
    // Hides the Next dev indicator, which covers mobile controls (next.config.ts, TG-009).
    E2E_SERVER: "1",
    DATABASE_URL: url,
    DIRECT_URL: url,
    BETTER_AUTH_SECRET: options.authSecret,
    BETTER_AUTH_URL: `http://localhost:${options.port}`,
    GOOGLE_CLIENT_ID: options.google ? FAKE_GOOGLE_CLIENT_ID : "",
    GOOGLE_CLIENT_SECRET: options.google ? "verify-fake-google-secret" : "",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    EMAIL_FROM: "",
    DEV_OUTBOX_DIR: options.outboxDir,
    RATE_LIMIT_DISABLED: "1",
    CRON_SECRET: options.cronSecret,
    APP_ADMIN_EMAILS: "jesper@example.com",
  };
}

export function outboxDir(id: string): string {
  return path.join(instanceDir(id), "outbox");
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

/** Signs in through Better Auth's API and returns the Cookie header for later requests. */
export async function signInCookie(url: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${url}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: url },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Login som ${email} fejlede: HTTP ${response.status} ${await response.text()}`);
  }
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
