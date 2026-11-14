import { existsSync, readdirSync } from "node:fs";

import { SEED_PASSWORD } from "./fixtures";
import {
  appDir,
  DATABASE_PREFIX,
  databaseName,
  isOurServer,
  processEnv,
  queryInstance,
  readState,
  signInCookie,
} from "./instance";

/**
 * Read-only health check of instance `id`. Passes only when the process is
 * ours and alive, runs with the instance's own database and no .env file, and
 * really reads that database (the marker user only exists there). Prints one
 * OK/FAIL line per check and returns false on any failure.
 */
export async function doctor(id: string): Promise<boolean> {
  const failures: string[] = [];
  const check = (ok: boolean, line: string) => {
    console.log(`${ok ? "OK  " : "FAIL"} ${line}`);
    if (!ok) failures.push(line);
  };

  const state = readState(id);
  if (!state) {
    check(false, `ingen instans ${id} (kør verify:up -- --id ${id})`);
    return false;
  }

  check(isOurServer(state), `pid ${state.pid} lever og er next dev i ${appDir(id)}`);
  if (failures.length > 0) return false;

  const env = processEnv(state.pid);
  check(
    state.database === databaseName(id) && state.database.startsWith(DATABASE_PREFIX),
    `databasen er instansens egen (${state.database})`,
  );
  check(env.DATABASE_URL === state.databaseUrl, "serverens DATABASE_URL er instansens database");
  check(env.DIRECT_URL === state.databaseUrl, "serverens DIRECT_URL er instansens database");
  check(env.BETTER_AUTH_URL === state.url, `serverens BETTER_AUTH_URL er ${state.url}`);
  check(env.NODE_ENV === "test", "NODE_ENV=test (Next læser aldrig .env.local)");

  const envFiles = readdirSync(appDir(id)).filter(
    (name) => name.startsWith(".env") && name !== ".env.example",
  );
  check(
    envFiles.length === 0,
    `ingen .env-filer i kopien${envFiles.length ? `: ${envFiles}` : ""}`,
  );
  check(existsSync(`${appDir(id)}/node_modules/next`), "node_modules findes i kopien");

  try {
    const response = await fetch(`${state.url}/api/auth/ok`);
    check(response.ok, `${state.url}/api/auth/ok svarer ${response.status}`);
  } catch (error) {
    check(false, `${state.url} svarer ikke: ${String(error)}`);
    return false;
  }

  const markers = await queryInstance(state, "SELECT 1 FROM users WHERE email = $1", [
    state.markerEmail,
  ]);
  check(markers.length === 1, `markør-brugeren ${state.markerEmail} står i databasen`);
  try {
    const cookie = await signInCookie(state.url, state.markerEmail, SEED_PASSWORD);
    // Without a club the user lands on /onboarding, which shows "Logget ind som <email>".
    const html = await (await fetch(`${state.url}/onboarding`, { headers: { cookie } })).text();
    check(
      html.includes(state.markerEmail),
      "appen læser instansens database (markør-login virker, onboarding viser markøren)",
    );
  } catch (error) {
    check(false, `markør-login fejlede: ${String(error)}`);
  }

  console.log(failures.length === 0 ? `DOCTOR OK ${id} ${state.url}` : `DOCTOR FAIL ${id}`);
  return failures.length === 0;
}
