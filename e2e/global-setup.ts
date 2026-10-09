import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

import { pgConfig } from "../src/server/db/pg-config";
import { truncateAppTables } from "../tests/support/truncate-app-tables";
import { e2eOutboxDir, testDirectUrl } from "./test-env";

/**
 * Runs once before all E2E tests (after the webServer is up):
 *
 * 1. Applies pending migrations to the test database. The webServer command
 *    does this too, but it is skipped when an already running server is reused.
 * 2. Empties every application table, so each run starts from a clean slate.
 *    The schema and the migration history are kept.
 * 3. Empties the E2E email outbox, so a test never reads a reset link from an
 *    earlier run (test emails repeat between runs because the DB is emptied).
 *
 * test-env.ts has already verified that the URLs point at a "*_test" database.
 */
export default async function globalSetup(): Promise<void> {
  execFileSync(path.join("node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
    stdio: ["ignore", "ignore", "inherit"],
    env: process.env,
  });

  const client = new Client(pgConfig(testDirectUrl));
  await client.connect();
  try {
    await truncateAppTables(client);
  } finally {
    await client.end();
  }

  clearE2eOutbox();
}

/**
 * Deletes the E2E outbox directory (.dev-outbox/e2e in .env.test). Only a
 * directory strictly inside .dev-outbox/ is deleted, so a misconfigured
 * DEV_OUTBOX_DIR can never remove the normal dev outbox or anything else.
 */
function clearE2eOutbox(): void {
  const outboxRoot = path.resolve(process.cwd(), ".dev-outbox");
  if (!e2eOutboxDir.startsWith(`${outboxRoot}${path.sep}`)) {
    console.warn(
      `[e2e] Outboxen tømmes ikke: DEV_OUTBOX_DIR (${e2eOutboxDir}) ligger ikke under .dev-outbox/.`,
    );
    return;
  }
  rmSync(e2eOutboxDir, { recursive: true, force: true });
}
