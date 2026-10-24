import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/**
 * Steps through the real UI, shared by the E2E specs. Selectors use roles and
 * the Danish labels, like a user (and a screen reader) would find things.
 */

export type TestUser = { name: string; email: string; password: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLUB_URL = new RegExp(`/c/(${UUID})(?:[/?#]|$)`);

let counter = 0;

/**
 * A fresh user for this test. The email is unique per test run, project
 * (desktop/mobile) and call, so tests can run in parallel.
 */
export function newUser(testInfo: TestInfo, label: string): TestUser {
  counter += 1;
  const unique = `${Date.now().toString(36)}${counter}${testInfo.workerIndex}`;
  const project = testInfo.project.name;
  const first = label.charAt(0).toUpperCase() + label.slice(1);
  return {
    name: `${first} ${project === "mobile" ? "Mobil" : "Desktop"}`,
    email: `e2e-${label}-${project}-${unique}@example.test`,
    password: `Skaal-${unique}-123`,
  };
}

/** A club name that is unique enough to find in lists, ≤ 60 characters. */
export function clubName(testInfo: TestInfo, label: string): string {
  counter += 1;
  return `${label} ${testInfo.project.name === "mobile" ? "M" : "D"}${counter}${testInfo.workerIndex}`;
}

/** /signup (optionally with ?next=), fills the form and submits. Does not wait for the redirect. */
export async function signUp(page: Page, user: TestUser, options: { next?: string } = {}) {
  await page.goto(options.next ? `/signup?next=${encodeURIComponent(options.next)}` : "/signup");
  await fillSignUpForm(page, user);
}

export async function fillSignUpForm(page: Page, user: TestUser) {
  await expect(page.getByRole("heading", { level: 1, name: "Opret konto" })).toBeVisible();
  await page.getByLabel("Navn").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Gentag password").fill(user.password);
  await page.getByRole("button", { name: "Opret konto" }).click();
}

/** /login, fills the form and submits. Does not wait for the redirect. */
export async function logIn(page: Page, user: Pick<TestUser, "email" | "password">) {
  if (!new URL(page.url(), "http://x").pathname.startsWith("/login")) {
    await page.goto("/login");
  }
  await fillLogInForm(page, user);
}

export async function fillLogInForm(page: Page, user: Pick<TestUser, "email" | "password">) {
  await expect(page.getByRole("heading", { level: 1, name: "Log ind" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
}

/** The visible main navigation (sidebar on desktop, bottom nav on mobile). */
export function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Hovednavigation" });
}

/**
 * The way to Profil: the "Profil" item in the bottom nav on mobile, the user
 * row at the bottom of the sidebar on desktop ("Profil: <name> <email>"). The
 * sidebar's list has no Profil item.
 */
export function profileLink(page: Page): Locator {
  return mainNav(page).getByRole("link", { name: /^Profil(?::|$)/ });
}

/** Profil → Log ud (SPEC §9.8), and waits for /login. */
export async function logOut(page: Page) {
  await profileLink(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  // The Profil page's button (the desktop sidebar has one too).
  await page.getByRole("main").getByRole("button", { name: "Log ud" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** The club id in the current URL (/c/<id>/…). */
export function clubIdFromUrl(page: Page): string {
  const match = CLUB_URL.exec(new URL(page.url()).pathname);
  if (!match?.[1]) throw new Error(`E2E: ingen klub i URL'en ${page.url()}`);
  return match[1];
}

/**
 * Waits until the page is a club's Overblik and returns the club id. Its h1
 * "Overblik" is visually hidden (the next event comes first, SPEC §3.2), but
 * still in the accessibility tree.
 */
export async function expectOverview(page: Page, clubId?: string): Promise<string> {
  await expect(page).toHaveURL(clubId ? new RegExp(`/c/${clubId}$`) : new RegExp(`/c/${UUID}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Overblik" })).toBeVisible();
  return clubIdFromUrl(page);
}

/** "Opret ølklub" on /onboarding (navigates there first). Returns the new club's id. */
export async function createClub(page: Page, name: string): Promise<string> {
  if (!page.url().endsWith("/onboarding")) await page.goto("/onboarding");
  await page.getByLabel("Klubbens navn").fill(name);
  await page.getByRole("button", { name: "Opret ølklub" }).click();
  return expectOverview(page);
}

/** A new user with a new club, logged in on `page`, on the club's Overblik. */
export async function signUpWithClub(page: Page, user: TestUser, name: string): Promise<string> {
  await signUp(page, user);
  await expect(page).toHaveURL(/\/onboarding$/);
  return createClub(page, name);
}

/** The invitation link shown by InviteShare (Overblik card or club page), as a path. */
export async function readInvitePath(page: Page): Promise<string> {
  const url = await page.getByLabel("Invitationslink").inputValue();
  const { pathname } = new URL(url);
  expect(pathname).toMatch(/^\/join\/[2-9A-HJKMNP-Z]{8}$/);
  return pathname;
}

/** The club page's member rows. */
export function memberRows(page: Page) {
  return page.getByRole("region", { name: "Medlemmer" }).getByRole("listitem");
}

/**
 * Waits until React has hydrated the element (its props are attached). A
 * click on a JavaScript-only control (a dialog trigger, the rating stars)
 * right after a full page load can otherwise land before hydration and do
 * nothing. Links and forms work before hydration and need no wait.
 */
export async function expectHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps$")),
      ),
    )
    .toBe(true);
}
