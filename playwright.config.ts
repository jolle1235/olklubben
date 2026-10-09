import { defineConfig, devices } from "@playwright/test";

// Must be imported before anything reads process.env: loads .env.test (never
// .env.local) and refuses to run unless the database name ends in "_test".
import { E2E_BASE_URL, E2E_PORT } from "./e2e/test-env";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  // The flows walk several pages, and `next dev` compiles each route on its first hit.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: E2E_BASE_URL,
    locale: "da-DK",
    timezoneId: "Europe/Copenhagen",
    trace: "on-first-retry",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      // SPEC §15.1: the mobile layout must work at 375 px.
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 667 } },
    },
  ],

  webServer: {
    // `next dev` (not build + start) so the app behaves as in development, e.g.
    // emails go to .dev-outbox/ (D-024). NEXT_DIST_DIR keeps it apart from a
    // normal `npm run dev` on port 3000; NODE_ENV=test makes Next.js and Prisma
    // read .env.test instead of .env.local.
    // A fresh start on an old .next-e2e/dev (Turbopack's dev cache) can reload
    // in a loop for the first requests (F-013, F-062), so it is cleared each
    // time this command starts a server. A running server is reused as is.
    command: `node -e "require('node:fs').rmSync('.next-e2e/dev', { recursive: true, force: true })" && npx prisma migrate deploy && npx next dev --port ${E2E_PORT}`,
    // Readiness probe: Better Auth's health endpoint (200 {"ok":true}). Not "/":
    // Playwright follows redirects, and "/" redirects logged-out visitors to
    // /login (src/proxy.ts), so the probe would depend on the login page. This
    // URL also makes sure the env is valid and the auth route compiles.
    url: `${E2E_BASE_URL}/api/auth/ok`,
    // E2E_SERVER=1 turns off the Next dev indicator (next.config.ts, TG-009).
    env: { NODE_ENV: "test", NEXT_DIST_DIR: ".next-e2e", E2E_SERVER: "1" },
    reuseExistingServer: !isCI,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
