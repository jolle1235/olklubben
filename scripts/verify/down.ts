import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import {
  appDir,
  databaseName,
  dropDatabase,
  evidenceDir,
  instanceDir,
  isOurServer,
  listInstanceIds,
  readState,
  releasePorts,
  REPO_ROOT,
  serverLogPath,
} from "./instance";

/**
 * Stops instance `id`: kills the process group it recorded (only after
 * checking the pid is still its next dev), drops its database, removes its
 * worktree and directory. The server log is copied to the evidence directory
 * first; evidence is never deleted.
 */
export async function down(id: string, options: { quiet?: boolean } = {}): Promise<void> {
  const say = (line: string) => {
    if (!options.quiet) console.log(line);
  };
  const state = readState(id);

  if (state && isOurServer(state)) {
    await stopProcessGroup(state.pid);
    say(`${id}: next dev (pid ${state.pid}) stoppet`);
  }

  if (existsSync(serverLogPath(id))) {
    mkdirSync(evidenceDir(id), { recursive: true });
    copyFileSync(serverLogPath(id), path.join(evidenceDir(id), "server.log"));
  }

  await dropDatabase(state?.database ?? databaseName(id));

  if (existsSync(appDir(id))) {
    execFileSync("git", ["worktree", "remove", "--force", appDir(id)], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
  }
  rmSync(instanceDir(id), { recursive: true, force: true });
  releasePorts(id);
  execFileSync("git", ["worktree", "prune"], { cwd: REPO_ROOT });
  say(`${id}: nede (database, worktree og instansmappe fjernet; evidens i ${evidenceDir(id)})`);
}

export async function downAll(): Promise<void> {
  const ids = listInstanceIds();
  if (ids.length === 0) console.log("Ingen instanser.");
  for (const id of ids) await down(id);
}

/** SIGTERM to the group (next dev forks next-server), SIGKILL after 5 s. */
async function stopProcessGroup(pid: number): Promise<void> {
  signalGroup(pid, "SIGTERM");
  for (let waited = 0; waited < 5_000; waited += 200) {
    if (!groupAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  signalGroup(pid, "SIGKILL");
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone.
  }
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}
