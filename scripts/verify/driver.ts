import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium, devices, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { SEED_PASSWORD, USERS, type SeedUser } from "./fixtures";
import { evidenceDir, isOurServer, outboxDir, queryInstance, readState } from "./instance";

/**
 * What a check script imports to drive a running verify instance:
 *
 *   const app = await openApp("my-task-after", { as: "jesper", viewport: "mobile" });
 *   await app.goto(`/c/${CLUBS.drengene.id}/beers`);
 *   await app.shot("katalog");
 *   const rows = await app.sql("SELECT name FROM beers WHERE club_id = $1", [CLUBS.drengene.id]);
 *   await app.close();
 *
 * and `createReport()` for the PASS/FAIL/PROBLEM lines (profile → Check script).
 */

export type Viewport = "desktop" | "mobile";

/** A seed user's key, any email + password, or null for a logged-out browser. */
export type Login = SeedUser | { email: string; password: string } | null;

export type App = {
  url: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /**
   * Navigates to a path and waits until the page's h1 is hydrated (React has
   * attached its props). The h1 sits inside the page's own loading.tsx
   * boundary, which hydrates after the shell; a click before that can be lost
   * when the client re-renders (a catalogue link was, 2026-11-14). Content that
   * appears later still needs its own wait.
   */
  goto: (pagePath: string) => Promise<void>;
  /** Full-page screenshot to <evidence>/<name>.png; returns the path. */
  shot: (name: string) => Promise<string>;
  /** Console errors, page errors, failed requests and 5xx responses seen so far. */
  problems: () => string[];
  /** A query against the instance's own database, to read saved state back. */
  sql: <T extends object>(query: string, params?: unknown[]) => Promise<T[]>;
  /** Emails the instance has "sent" (its dev outbox, D-024), oldest first. */
  outbox: () => OutboxEmail[];
  close: () => Promise<void>;
};

export type OutboxEmail = {
  to: string;
  subject: string;
  text: string;
  links: string[];
  createdAt: string;
};

const VIEWPORTS = {
  desktop: { ...devices["Desktop Chrome"] },
  // SPEC §15.1: the mobile layout must work at 375 px (as in playwright.config.ts).
  mobile: { ...devices["Pixel 5"], viewport: { width: 375, height: 667 } },
} as const;

export async function openApp(
  id: string,
  options: { as?: Login; viewport?: Viewport; evidence?: string; headed?: boolean } = {},
): Promise<App> {
  const state = readState(id);
  if (!state || !isOurServer(state)) {
    throw new Error(`Instansen ${id} kører ikke (npm run verify:up -- --id ${id}).`);
  }
  const evidence = path.resolve(options.evidence ?? evidenceDir(id));
  mkdirSync(evidence, { recursive: true });

  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({
    ...VIEWPORTS[options.viewport ?? "desktop"],
    baseURL: state.url,
    locale: "da-DK",
    timezoneId: "Europe/Copenhagen",
  });

  const login = options.as === undefined ? "jesper" : options.as;
  if (login) {
    const credentials =
      typeof login === "string" ? { email: USERS[login].email, password: SEED_PASSWORD } : login;
    // The context's request API shares its cookie jar, so the page is logged in too.
    const response = await context.request.post("/api/auth/sign-in/email", {
      data: credentials,
      headers: { origin: state.url },
    });
    if (!response.ok()) {
      await browser.close();
      throw new Error(`Login som ${credentials.email} fejlede: HTTP ${response.status()}`);
    }
  }

  const page = await context.newPage();
  const seen: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") seen.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => seen.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    // Next aborts prefetches and RSC requests when a navigation wins: not a problem.
    if (!failure.includes("ERR_ABORTED")) seen.push(`requestfailed: ${request.url()} ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) seen.push(`http ${response.status()}: ${response.url()}`);
  });

  return {
    url: state.url,
    browser,
    context,
    page,
    goto: async (pagePath) => {
      await page.goto(pagePath);
      // <body> hydrates with the shell; the page's h1 only with its own (streamed) boundary.
      await page.waitForFunction(() => {
        const element = document.querySelector("h1") ?? document.body;
        return Object.keys(element).some((key) => key.startsWith("__reactProps$"));
      });
    },
    shot: async (name) => {
      const file = path.join(evidence, `${name}.png`);
      // caret "initial": hiding the caret styles the focused input, and during
      // hydration React reports that as a mismatch (a PROBLEM the app didn't cause).
      await page.screenshot({ path: file, fullPage: true, caret: "initial" });
      return file;
    },
    problems: () => [...seen],
    sql: (query, params) => queryInstance(state, query, params),
    outbox: () => readOutbox(id),
    close: () => browser.close(),
  };
}

function readOutbox(id: string): OutboxEmail[] {
  const dir = outboxDir(id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), "utf8")) as OutboxEmail);
}

/**
 * The output contract of a check script: one `PASS|FAIL <name> | <detail>`
 * line per expectation, one `PROBLEM <text>` per console/page/API problem, and
 * exit code 1 when anything failed.
 */
export function createReport() {
  let failed = 0;
  return {
    /** Runs one expectation; a thrown error is a FAIL with its first line as detail. */
    async check(name: string, run: () => Promise<string | void>): Promise<boolean> {
      try {
        const detail = await run();
        console.log(`PASS ${name}${detail ? ` | ${detail}` : ""}`);
        return true;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.log(`FAIL ${name} | ${failDetail(message)}`);
        return false;
      }
    },
    /** Prints the problems and exits: 0 only with no FAIL and no PROBLEM. */
    finish(problems: string[]): never {
      for (const problem of problems) console.log(`PROBLEM ${problem}`);
      const ok = failed === 0 && problems.length === 0;
      console.log(ok ? "RESULT PASS" : `RESULT FAIL (${failed} FAIL, ${problems.length} PROBLEM)`);
      process.exit(ok ? 0 : 1);
    },
  };
}

/** The first line of an error, plus Playwright's "Locator:" line, so a FAIL says what it looked for. */
function failDetail(message: string): string {
  const lines = message.split("\n").map((line) => line.trim());
  const first = lines.find(Boolean) ?? "";
  const locator = lines.find((line) => line.startsWith("Locator:"));
  return locator ? `${first} (${locator})` : first;
}
