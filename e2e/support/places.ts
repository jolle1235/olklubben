import { expect, type Page, type Request } from "@playwright/test";

import { sql } from "./db";

/**
 * Round 3 helpers for Steder (SPEC §9.4) in the E2E specs. UI steps use roles
 * and the Danish labels; the database helpers read olklubben_test directly.
 * Places for setup come from insertPlace/insertEvent in ./db.ts.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export type PlaceInput = {
  name?: string;
  address?: string;
  description?: string;
  /** "Det er mit sted" (only on "Nyt sted"). */
  mine?: boolean;
};

export function placesPath(clubId: string): string {
  return `/c/${clubId}/places`;
}

export function placePath(clubId: string, placeId: string): string {
  return `${placesPath(clubId)}/${placeId}`;
}

/** The place form's fields. Fills only what is given. */
export async function fillPlaceForm(page: Page, input: PlaceInput): Promise<void> {
  if (input.name !== undefined) await page.getByLabel("Navn").fill(input.name);
  if (input.address !== undefined) await page.getByLabel(/^Adresse/).fill(input.address);
  if (input.description !== undefined) {
    await page.getByLabel(/^Beskrivelse/).fill(input.description);
  }
  if (input.mine !== undefined) await page.getByLabel("Det er mit sted").setChecked(input.mine);
}

/** Waits for a place's page (h1 = its name) and returns the place id from the URL. */
export async function expectPlacePage(page: Page, clubId: string, name: string): Promise<string> {
  await expect(page).toHaveURL(new RegExp(`/c/${clubId}/places/(${UUID})(\\?|$)`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const match = new RegExp(`/places/(${UUID})`).exec(page.url());
  if (!match?.[1]) throw new Error(`E2E: intet sted i URL'en ${page.url()}`);
  return match[1];
}

/** "Nyt sted" through the form. Returns the new place's id. */
export async function createPlaceViaForm(
  page: Page,
  clubId: string,
  input: PlaceInput & { name: string },
): Promise<string> {
  await page.goto(`${placesPath(clubId)}/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Nyt sted" })).toBeVisible();
  await fillPlaceForm(page, input);
  await page.getByRole("button", { name: "Opret sted" }).click();
  return expectPlacePage(page, clubId, input.name.replace(/\s+/g, " ").trim());
}

/** The "Ejere" section of a place's page. */
export function ownersRegion(page: Page) {
  return page.getByRole("region", { name: "Ejere" });
}

/** The emails of the place's owners, sorted. */
export async function placeOwnerEmails(placeId: string): Promise<string[]> {
  const rows = await sql<{ email: string }>(
    `SELECT u.email FROM place_owners o JOIN users u ON u.id = o.user_id
     WHERE o.place_id = $1 ORDER BY u.email`,
    [placeId],
  );
  return rows.map((row) => row.email);
}

/** The place's row (null when deleted). */
export async function placeRow(
  placeId: string,
): Promise<{ name: string; address: string | null; archived: boolean } | null> {
  const [row] = await sql<{ name: string; address: string | null; archived: boolean }>(
    "SELECT name, address, archived_at IS NOT NULL AS archived FROM places WHERE id = $1",
    [placeId],
  );
  return row ?? null;
}

export async function archivePlace(placeId: string): Promise<void> {
  await sql("UPDATE places SET archived_at = now() WHERE id = $1", [placeId]);
}

/** True when the page can scroll sideways (it must not, F-028/F-047). */
export function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** A Server Action call (POST with the Next-Action header). */
export function isServerActionCall(request: Request): boolean {
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

/**
 * The id of the Server Action a click sends, without letting it run: the
 * request is aborted (the dialog then shows the generic error). Only for
 * disposable data.
 */
export async function captureActionId(page: Page, click: () => Promise<void>): Promise<string> {
  let actionId: string | null = null;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!isServerActionCall(request)) return route.fallback();
    actionId = request.headers()["next-action"] ?? null;
    await route.abort();
  });
  await click();
  await expect.poll(() => actionId).not.toBeNull();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  return actionId ?? "";
}
