import { expect, type Page, type TestInfo } from "@playwright/test";

import { formatLongDate } from "../../src/lib/format/date";
import {
  addDaysToDateKey,
  utcToZonedParts,
  zonedDateTimeToUtc,
  type DateKey,
} from "../../src/server/domain/events/time";
import { expectHydrated, expectOverview, readInvitePath, signUp, type TestUser } from "./app";

/**
 * Round 2 helpers (events, calendar, beers, ratings) for the E2E specs. Dates
 * are Copenhagen calendar days relative to today, so the tests run on any
 * day; the UI steps use roles and the Danish labels.
 */

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name === "mobile";
}

/** Today in Copenhagen, "YYYY-MM-DD". */
export function today(): DateKey {
  return utcToZonedParts(new Date()).date;
}

/** A Copenhagen date `days` days from today, "YYYY-MM-DD". */
export function dayFromToday(days: number): DateKey {
  const key = addDaysToDateKey(today(), days);
  if (!key) throw new Error("E2E: ugyldig dato");
  return key;
}

/** The UTC instant of a Copenhagen date and wall-clock time. */
export function at(dateKey: string, time: string): Date {
  const instant = zonedDateTimeToUtc(dateKey, time);
  if (!instant) throw new Error(`E2E: ugyldig tid ${dateKey} ${time}`);
  return instant;
}

/**
 * The next night the clocks go back (the last Sunday of October, E20), at
 * least two days ahead, so an event that evening is still upcoming.
 */
export function nextDstEndDay(): DateKey {
  const now = new Date();
  for (let year = Number(today().slice(0, 4)); ; year += 1) {
    const lastOfOctober = new Date(Date.UTC(year, 9, 31));
    const lastSunday = 31 - lastOfOctober.getUTCDay();
    const key = `${year}-10-${String(lastSunday).padStart(2, "0")}`;
    if (at(key, "12:00").getTime() > now.getTime() + 2 * DAY) return key;
  }
}

/** "søndag 25. oktober" (+ the year when it is not this year), as the app writes it. */
export function longDate(dateKey: string): string {
  return formatLongDate(at(dateKey, "12:00"), new Date());
}

/** The last path segment of the current URL (a new event's or beer's id). */
export function idFromUrl(page: Page): string {
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

/**
 * The owner reads the club's invitation link; `member` signs up through it
 * and joins (a second, ordinary member of the club).
 */
export async function joinClub(
  ownerPage: Page,
  memberPage: Page,
  member: TestUser,
  clubId: string,
): Promise<void> {
  await ownerPage.goto(`/c/${clubId}/club`);
  const invitePath = await readInvitePath(ownerPage);
  await signUp(memberPage, member, { next: invitePath });
  await memberPage.getByRole("button", { name: "Join klub" }).click();
  await expectOverview(memberPage, clubId);
}

export type EventInput = {
  title?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  locationText: string;
  theme?: string;
  /** "Beskrivelse / plan". */
  description?: string;
};

/** "Opret event" through the form (SPEC §10.4). Returns the new event's id. */
export async function createEventViaForm(
  page: Page,
  clubId: string,
  input: EventInput,
): Promise<string> {
  await page.goto(`/c/${clubId}/events/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Opret event" })).toBeVisible();
  if (input.title !== undefined) await page.getByLabel("Titel").fill(input.title);
  await page.getByLabel("Dato").fill(input.date);
  if (input.startTime) await page.getByLabel("Starttid").fill(input.startTime);
  if (input.endTime) await page.getByLabel(/^Sluttid/).fill(input.endTime);
  await page.getByLabel("Sted").fill(input.locationText);
  if (input.theme) await page.getByLabel(/^Tema/).fill(input.theme);
  if (input.description) await page.getByLabel(/^Beskrivelse \/ plan/).fill(input.description);
  await page.getByRole("button", { name: "Opret event" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${clubId}/events/${UUID}$`));
  return idFromUrl(page);
}

/** The beer form's fields (SPEC §9.5). Fills only what is given. */
export async function fillBeerForm(
  page: Page,
  input: { name?: string; abv?: string; eventLabel?: string | RegExp },
): Promise<void> {
  if (input.name !== undefined) await page.getByLabel("Navn").fill(input.name);
  if (input.abv !== undefined) await page.getByLabel("Alkoholprocent").fill(input.abv);
  if (input.eventLabel !== undefined) {
    const select = page.getByLabel("Event (valgfrit)");
    const option = select.getByRole("option", { name: input.eventLabel });
    await select.selectOption({ label: (await option.textContent()) ?? "" });
  }
}

/** The beer page reached after "Tilføj øl" (with its toast); returns the beer's id. */
export async function expectNewBeerPage(page: Page, clubId: string, name: string) {
  await expect(page).toHaveURL(new RegExp(`/c/${clubId}/beers/${UUID}$`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return idFromUrl(page);
}

/** "Tilføj øl" through the form, from the catalogue's URL. Returns the new beer's id. */
export async function addBeerViaForm(
  page: Page,
  clubId: string,
  input: { name: string; abv: string; eventLabel?: string | RegExp },
): Promise<string> {
  await page.goto(`/c/${clubId}/beers/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Tilføj øl" })).toBeVisible();
  await fillBeerForm(page, input);
  await page.getByRole("button", { name: "Tilføj øl", exact: true }).click();
  return expectNewBeerPage(page, clubId, input.name);
}

/** The interactive rating on the beer page (<BeerRating />, a radio group). */
export function ratingGroup(page: Page) {
  return page.getByRole("radiogroup", { name: "Din rating" });
}

/** "Klubbens rating" on the beer page. */
export function clubRating(page: Page) {
  return page.getByRole("region", { name: "Klubbens rating" });
}

/**
 * Taps a star like a finger would (SPEC §9.5): 4.5 → the LEFT half of the
 * fifth star, 4 → the right half of the fourth, 1 → the first star.
 */
export async function tapStars(page: Page, stars: number): Promise<void> {
  await expectHydrated(ratingGroup(page));
  const index = Math.ceil(stars) - 1;
  const half = !Number.isInteger(stars);
  const star = ratingGroup(page).locator(":scope > span").nth(index);
  const box = await star.boundingBox();
  if (!box) throw new Error("E2E: stjernen er ikke synlig");
  await star.click({
    position: { x: box.width * (half ? 0.25 : 0.8), y: box.height / 2 },
  });
}

/** Waits for the small "Gemt ✓" after a rating was saved. */
export async function expectRatingSaved(page: Page): Promise<void> {
  await expect(page.getByText("Gemt ✓", { exact: true })).toBeVisible();
}
