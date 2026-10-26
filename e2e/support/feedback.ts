import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { expectHydrated, fillSignUpForm, logIn, type TestUser } from "./app";
import { sql } from "./db";

/**
 * Helpers for Feedback (SPEC §9.9) in the E2E specs. Feedback is APP-WIDE:
 * every test (and both projects) sees every other test's reports, so specs
 * never assume an empty list or exact counts. Reports get unique titles
 * (feedbackTitle) and are found by title, or under "Mine rapporter".
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

let counter = 0;

/** A report title unique per run, project and call (3–120 characters). */
export function feedbackTitle(testInfo: TestInfo, label: string): string {
  counter += 1;
  const project = testInfo.project.name === "mobile" ? "M" : "D";
  return `${label} ${project}${Date.now().toString(36)}${counter}${testInfo.workerIndex}`;
}

/**
 * The project's app-admin (APP_ADMIN_EMAILS in .env.test): one fixed account
 * per Playwright project, so desktop and mobile never share it.
 */
export function appAdmin(testInfo: TestInfo): TestUser {
  return {
    name: `App-admin ${testInfo.project.name === "mobile" ? "Mobil" : "Desktop"}`,
    email: `e2e-appadmin-${testInfo.project.name}@example.test`,
    password: "Skaal-appadmin-12345",
  };
}

/**
 * Marks the account's email as verified, as a Google login would (D-165):
 * app-admin needs both APP_ADMIN_EMAILS and a verified email, and password
 * sign-up never verifies it (D-029).
 */
export async function verifyEmail(user: TestUser): Promise<void> {
  await sql("UPDATE users SET email_verified = true WHERE email = $1", [user.email.toLowerCase()]);
}

/**
 * Logs the user in, signing up first if the account does not exist yet (the
 * database is emptied before every run, but a retry finds the account).
 */
export async function signUpOrLogIn(page: Page, user: TestUser): Promise<void> {
  const [existing] = await sql("SELECT 1 FROM users WHERE email = $1", [user.email.toLowerCase()]);
  if (existing) {
    await logIn(page, user);
  } else {
    await page.goto("/signup");
    await fillSignUpForm(page, user);
  }
  await expect(page).not.toHaveURL(/\/(login|signup)(\?|$)/);
}

/** Waits for a report's page (h1 = its title) and returns its id. */
export async function expectFeedbackPage(page: Page, title: string): Promise<string> {
  await expect(page).toHaveURL(new RegExp(`/feedback/(${UUID})(\\?|$)`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const match = new RegExp(`/feedback/(${UUID})`).exec(page.url());
  if (!match?.[1]) throw new Error(`E2E: ingen rapport i URL'en ${page.url()}`);
  return match[1];
}

export type FeedbackInput = {
  type: "BUG" | "FEATURE";
  title: string;
  description: string;
};

/** Fills "Ny rapport" (already open) and sends it. Returns the new report's id. */
export async function submitFeedbackForm(page: Page, input: FeedbackInput): Promise<string> {
  await expect(page.getByRole("heading", { level: 1, name: "Ny rapport" })).toBeVisible();
  // Hydrated, so the browser's checks and the screen width (a hidden field) are in place.
  const send = page.getByRole("button", { name: "Send" });
  await expectHydrated(send);
  await page.getByRole("radio", { name: input.type === "BUG" ? "Fejl" : "Idé / ønske" }).check();
  await page.getByLabel("Titel").fill(input.title);
  await page.getByLabel("Beskrivelse").fill(input.description);
  await send.click();
  const id = await expectFeedbackPage(page, input.title);
  await expect(page.getByText("Tak! Din rapport er gemt 🍻")).toBeVisible();
  return id;
}

/** /feedback/new (optionally with ?type=&page=), filled and sent. Returns the id. */
export async function createFeedback(
  page: Page,
  input: FeedbackInput,
  query = "",
): Promise<string> {
  await page.goto(`/feedback/new${query}`);
  return submitFeedbackForm(page, input);
}

/** The list's card for a report, found by its (unique) title. */
export function feedbackCard(page: Page, title: string): Locator {
  return page.getByRole("list", { name: "Rapporter" }).getByRole("link", { name: title });
}

/** One of the list's filter groups ("Type", "Status", "Vis", "Sortér"). */
export function filterGroup(page: Page, name: "Type" | "Status" | "Vis" | "Sortér"): Locator {
  return page
    .getByRole("navigation", { name: "Filtrér og sortér" })
    .getByRole("list", { name, exact: true });
}

/** The "Stemmer" area of a report's page (the 👍 count and button). */
export function votesRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Stemmer" });
}

export type FeedbackRow = {
  status: string;
  page_path: string | null;
  user_agent: string | null;
  viewport_width: number | null;
  admin_response: string | null;
  duplicate_of_id: string | null;
};

/** The report's row (null when deleted). */
export async function feedbackRow(id: string): Promise<FeedbackRow | null> {
  const [row] = await sql<FeedbackRow>(
    `SELECT status, page_path, user_agent, viewport_width, admin_response, duplicate_of_id
     FROM feedback WHERE id = $1`,
    [id],
  );
  return row ?? null;
}

export async function feedbackVoteCount(id: string): Promise<number> {
  const [row] = await sql<{ count: string }>(
    "SELECT count(*) AS count FROM feedback_votes WHERE feedback_id = $1",
    [id],
  );
  return Number(row?.count ?? 0);
}

/** Sets a report's status directly (setup for the "Lukkede" filter). */
export async function setFeedbackStatus(id: string, status: "DONE" | "WONT_DO"): Promise<void> {
  await sql("UPDATE feedback SET status = $2::feedback_status WHERE id = $1", [id, status]);
}
