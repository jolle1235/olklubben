import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

import { CLUBS, EVENTS, SEED_PASSWORD, USERS, WARM_PATHS } from "./fixtures";
import {
  appDir,
  databaseName,
  databaseUrl,
  instanceDir,
  instanceEnv,
  claimPort,
  isOurServer,
  outboxDir,
  queryInstance,
  readState,
  recreateDatabase,
  REPO_ROOT,
  serverLogPath,
  signInCookie,
  writeState,
  type InstanceState,
} from "./instance";
import { down } from "./down";

const PORT_RANGE = { first: 3200, last: 3299 };
const READY_TIMEOUT_MS = 180_000;

/**
 * Starts (or reuses) instance `id`: the working tree, or commit `ref` from a
 * throwaway worktree, against a freshly migrated and seeded database on a free
 * port. Returns once the seeded pages answer, and prints the URL.
 *
 * The same id again reuses a running instance; for a working-tree instance it
 * first syncs the working tree's current changes into the copy (next dev
 * reloads them).
 */
export async function up(
  id: string,
  ref: string | undefined,
  options: { google: boolean },
): Promise<InstanceState> {
  const existing = readState(id);
  if (existing?.readyAt && isOurServer(existing)) return reuse(existing, ref, options);
  if (existsSync(instanceDir(id))) await down(id, { quiet: true });

  const sha = resolveSha(ref ?? "HEAD");
  createCopy(id, sha, { syncWorkingTree: !ref });

  const database = databaseName(id);
  const port = await freePort(id);
  const cronSecret = randomBytes(24).toString("hex");
  const env = instanceEnv({
    database,
    port,
    authSecret: randomBytes(32).toString("base64"),
    cronSecret,
    outboxDir: outboxDir(id),
    google: options.google,
  });
  await prepareDatabase(id, database, env);

  const state: InstanceState = {
    id,
    sha,
    pinned: Boolean(ref),
    google: options.google,
    port,
    url: `http://localhost:${port}`,
    database,
    databaseUrl: databaseUrl(database),
    pid: startServer(id, port, env),
    cronSecret,
    markerEmail: `verify-${id}@example.test`,
    startedAt: new Date().toISOString(),
  };
  writeState(state);

  await waitUntilReady(state);
  await createMarkerUser(state);
  await warmUp(state);
  const ready = { ...state, readyAt: new Date().toISOString() };
  writeState(ready);
  log(`READY ${id} ${state.url}`);
  return ready;
}

/** A running instance again: same commit and flags required; a working-tree copy is synced first. */
async function reuse(
  existing: InstanceState,
  ref: string | undefined,
  options: { google: boolean },
): Promise<InstanceState> {
  if (ref && resolveSha(ref) !== existing.sha) {
    throw new Error(
      `${existing.id} kører allerede på ${existing.sha.slice(0, 8)}; kør verify:down først.`,
    );
  }
  if ((existing.google ?? false) !== options.google) {
    throw new Error(
      `${existing.id} kører ${existing.google ? "med" : "uden"} --google; kør verify:down først.`,
    );
  }
  if (!existing.pinned) syncWorkingTree(existing.id);
  await waitUntilReady(existing);
  log(`READY ${existing.id} ${existing.url} (genbrugt)`);
  return existing;
}

/** The worktree at `sha` (plus the working tree's changes), without .env files, with node_modules. */
function createCopy(id: string, sha: string, options: { syncWorkingTree: boolean }): void {
  const app = appDir(id);
  mkdirSync(instanceDir(id), { recursive: true });
  log(`worktree ${sha.slice(0, 8)} → ${app}`);
  git(["worktree", "add", "--detach", app, sha]);
  if (options.syncWorkingTree) syncWorkingTree(id);
  removeEnvFiles(app);
  // Hard links: a copy in a few hundred ms. A symlink would point out of Turbopack's root.
  execFileSync("cp", ["-al", path.join(REPO_ROOT, "node_modules"), path.join(app, "node_modules")]);
}

/** A fresh database, migrated and seeded with the copy's own schema and seed. */
async function prepareDatabase(id: string, database: string, env: NodeJS.ProcessEnv) {
  const app = appDir(id);
  log(`database ${database}: migrate + seed`);
  await recreateDatabase(database);
  run(app, env, ["node_modules/.bin/prisma", "generate"]);
  run(app, env, ["node_modules/.bin/prisma", "migrate", "deploy"]);
  run(app, env, ["node_modules/.bin/tsx", "prisma/seed.ts"]);
}

/** next dev in its own process group (so `down` stops next-server too); returns the pid. */
function startServer(id: string, port: number, env: NodeJS.ProcessEnv): number {
  log(`next dev på port ${port}`);
  const logFd = openSync(serverLogPath(id), "a");
  const server = spawn("node", ["node_modules/next/dist/bin/next", "dev", "--port", String(port)], {
    cwd: appDir(id),
    env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  server.unref();
  if (!server.pid) throw new Error("next dev startede ikke.");
  return server.pid;
}

// ─── Working tree ───────────────────────────────────────────────────────────

const ENV_FILE = /^\.env(\..+)?$/;

function isEnvFile(file: string): boolean {
  const name = path.basename(file);
  return ENV_FILE.test(name) && name !== ".env.example";
}

/** Every .env file except .env.example: the instance's environment is complete without them. */
function removeEnvFiles(app: string): void {
  for (const name of readdirSync(app)) {
    if (isEnvFile(name)) rmSync(path.join(app, name), { force: true });
  }
}

/**
 * Makes the copy match the working tree: tracked and untracked (not ignored)
 * files whose content differs are copied, deleted ones removed. Only changed
 * files are written, so next dev reloads just those.
 */
function syncWorkingTree(id: string): void {
  const app = appDir(id);
  const listed = gitList(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  const deleted = new Set(gitList(["ls-files", "-z", "--deleted"]));
  const untracked = gitList(["ls-files", "-z", "--others", "--exclude-standard"]);

  let copied = 0;
  for (const file of listed) {
    if (deleted.has(file) || isEnvFile(file)) continue;
    const source = path.join(REPO_ROOT, file);
    const target = path.join(app, file);
    if (existsSync(target) && readFileSync(source).equals(readFileSync(target))) continue;
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    copied += 1;
  }

  // Deleted tracked files, and untracked files synced earlier that are gone now.
  const manifest = path.join(instanceDir(id), "synced-untracked.json");
  const earlier: string[] = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : [];
  const stillThere = new Set(untracked);
  const removed = [...deleted, ...earlier.filter((file) => !stillThere.has(file))];
  for (const file of removed) rmSync(path.join(app, file), { force: true });
  writeFileSync(manifest, JSON.stringify(untracked));

  log(`arbejdstræ synket: ${copied} filer kopieret, ${removed.length} fjernet`);
}

// ─── Readiness ──────────────────────────────────────────────────────────────

async function waitUntilReady(state: InstanceState): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!isOurServer(state)) {
      throw new Error(`next dev stoppede. Se ${serverLogPath(state.id)}:\n${logTail(state.id)}`);
    }
    try {
      const response = await fetch(`${state.url}/api/auth/ok`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error(
    `${state.url} svarede ikke inden ${READY_TIMEOUT_MS / 1000} s:\n${logTail(state.id)}`,
  );
}

/**
 * A user only this instance's database has. `doctor` logs in as it: that only
 * works when the server really reads this database.
 */
async function createMarkerUser(state: InstanceState): Promise<void> {
  const response = await fetch(`${state.url}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: state.url },
    body: JSON.stringify({
      name: `Verify ${state.id}`,
      email: state.markerEmail,
      password: SEED_PASSWORD,
    }),
  });
  if (!response.ok) {
    throw new Error(`Markør-brugeren kunne ikke oprettes: HTTP ${response.status}`);
  }
  const rows = await queryInstance(state, "SELECT 1 FROM users WHERE email = $1", [
    state.markerEmail,
  ]);
  if (rows.length !== 1) throw new Error("Serveren skrev markør-brugeren et andet sted hen.");
}

/** Opens /login logged out and the mapped pages as Kaptajnen, so next dev has compiled them. */
async function warmUp(state: InstanceState): Promise<void> {
  const cookie = await signInCookie(state.url, USERS.jesper.email, SEED_PASSWORD);
  for (const [pagePath, headers] of [
    ["/login", {}],
    ...WARM_PATHS.map((warmPath) => [warmPath, { cookie }] as const),
  ] as const) {
    const started = Date.now();
    const response = await fetch(`${state.url}${pagePath}`, { headers, redirect: "manual" });
    const html = await response.text();
    if (response.status !== 200) {
      throw new Error(`${pagePath} gav HTTP ${response.status} under opvarmningen.`);
    }
    if (pagePath === `/c/${CLUBS.drengene.id}` && !html.includes(EVENTS.next13.title)) {
      throw new Error(`Overblikket viser ikke "${EVENTS.next13.title}": er databasen seedet?`);
    }
    log(`  ${pagePath} 200 (${Date.now() - started} ms)`);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** First port in 3200–3299 that nothing listens on and this id could claim. */
async function freePort(id: string): Promise<number> {
  for (let port = PORT_RANGE.first; port <= PORT_RANGE.last; port += 1) {
    if (!(await isPortFree(port))) continue;
    if (claimPort(port, id)) return port;
  }
  throw new Error(`Ingen ledig port i ${PORT_RANGE.first}–${PORT_RANGE.last}.`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

function resolveSha(ref: string): string {
  return git(["rev-parse", "--verify", `${ref}^{commit}`]).trim();
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" });
}

function gitList(args: string[]): string[] {
  return git(args).split("\0").filter(Boolean);
}

function run(cwd: string, env: NodeJS.ProcessEnv, [command, ...args]: string[]): void {
  if (!command) return;
  try {
    execFileSync(command, args, { cwd, env, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
    throw new Error(`${command} ${args.join(" ")} fejlede:\n${stdout}${stderr}`);
  }
}

function logTail(id: string): string {
  const file = serverLogPath(id);
  if (!existsSync(file)) return "(ingen log)";
  return readFileSync(file, "utf8").split("\n").slice(-30).join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(line: string): void {
  console.log(line);
}
