import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { createClub, newUser, signUpWithClub } from "./support/app";
import { createEventViaForm, dayFromToday } from "./support/round2";

/**
 * Long club names (up to 60 characters, §7.2, also as one long word) wrap
 * instead of pushing the page sideways at 375 px (SPEC §15.1), and the club
 * switcher shows them in full instead of an ellipsis.
 */

// One 60-character word: the worst case for line breaking.
const LONG_WORD = "Ølklubbensjuleølssmagningsudvalgsformandsvalgsforsamlingerne";
const LONG_NAME = "Æblemostklubben Forenede Ølentusiaster";
// An unbroken URL in an event's plan, like a shared spreadsheet link.
const LONG_URL =
  "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing";

/** Nothing on the page is wider than the viewport. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "vandret scroll på siden").toBeLessThanOrEqual(0);
}

/**
 * The element's text is neither wider than the element nor cut off by a line
 * clamp. Only an element that clips (overflow ≠ visible) can cut text off at
 * the bottom; tight leading lets glyphs stick out a little, which is fine.
 */
async function expectFullyShown(locator: Locator) {
  const hidden = await locator.evaluate((element) => {
    const clips = getComputedStyle(element).overflowY !== "visible";
    return {
      x: element.scrollWidth - element.clientWidth,
      y: clips ? element.scrollHeight - element.clientHeight : 0,
    };
  });
  expect(hidden.x, "tekst skjult til siden").toBeLessThanOrEqual(0);
  expect(hidden.y, "tekst skåret af forneden").toBeLessThanOrEqual(1);
}

/** Every box stays inside the container's right edge. */
async function expectInside(items: Locator, container: Locator) {
  const outer = await container.boundingBox();
  if (!outer) throw new Error("E2E: containeren er ikke synlig");
  for (const item of await items.all()) {
    const box = await item.boundingBox();
    if (!box) throw new Error("E2E: elementet er ikke synligt");
    expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  }
}

test.describe("Lange klubnavne", () => {
  test("brydes pænt på klubsiden, i klubvælgeren og i klubskifteren", async ({
    page,
  }, testInfo) => {
    expect(LONG_WORD).toHaveLength(60);
    const user = newUser(testInfo, "langtnavn");
    const longWordId = await signUpWithClub(page, user, LONG_WORD);
    await createClub(page, LONG_NAME);

    // The club page's h1 (PageHeader) breaks the word instead of overflowing.
    await page.goto(`/c/${longWordId}/club`);
    const heading = page.getByRole("heading", { level: 1, name: LONG_WORD });
    await expect(heading).toBeVisible();
    await expectFullyShown(heading);
    await expectNoSidewaysScroll(page);

    // The club picker keeps every row inside its card.
    await page.goto("/clubs");
    const picker = page.getByRole("main").getByRole("list");
    await expect(picker.getByRole("link")).toHaveCount(2);
    await expectInside(picker.getByRole("link"), picker);
    await expectFullyShown(picker.getByText(LONG_NAME, { exact: true }));
    await expectNoSidewaysScroll(page);

    // The club switcher (top bar on mobile, sidebar on desktop) wraps names
    // instead of cutting them off, and fits on the screen.
    await picker.getByRole("link", { name: new RegExp(LONG_WORD) }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${longWordId}$`));
    await expectNoSidewaysScroll(page);
    const trigger = page.getByRole("button", { name: /Skift klub/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    const item = menu.getByRole("menuitemradio", { name: LONG_NAME });
    await expect(item).toBeVisible();
    await expectFullyShown(item.getByText(LONG_NAME, { exact: true }));
    await expectInside(menu, page.locator("body"));

    // The highlighted item keeps its badge colours (initials in amber), like
    // the other items.
    const other = menu.getByRole("menuitemradio", { name: LONG_WORD });
    await item.focus();
    await expect(item).toBeFocused();
    const badgeColor = (option: Locator) =>
      option
        .locator("span[aria-hidden]")
        .last()
        .evaluate((badge) => getComputedStyle(badge).color);
    expect(await badgeColor(item)).toBe(await badgeColor(other));
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });
});

test.describe("Lange ord i events", () => {
  test("en URL i planen og et langt ord i titlen brydes på eventsiden og på Tilføj øl", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "langtevent");
    const clubId = await signUpWithClub(page, user, "Lange Ord Klubben");
    const title = `Smagning ${LONG_WORD}`;
    const eventId = await createEventViaForm(page, clubId, {
      title,
      date: dayFromToday(5),
      locationText: "Hos E2E",
      description: `Regnearket med øllene: ${LONG_URL}`,
    });

    // The event page: the plan's URL wraps inside its column (F-028).
    const plan = page.getByRole("region", { name: "Planen" });
    await expect(plan.getByText(LONG_URL)).toBeVisible();
    await expectFullyShown(plan.getByText(LONG_URL));
    await expectNoSidewaysScroll(page);

    // "Til <event title>. …" under the heading of Tilføj øl.
    await page.goto(`/c/${clubId}/beers/new?eventId=${eventId}`);
    const description = page.getByText(`Til ${title}.`);
    await expect(description).toBeVisible();
    await expectFullyShown(description);
    await expectNoSidewaysScroll(page);
  });
});
