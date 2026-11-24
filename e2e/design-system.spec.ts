import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures";
import { clubName, newUser, settingsLink, signUpWithClub } from "./support/app";

/** "squircle" or "round", whether the browser serialises the keyword or superellipse(). */
function cornerShape(locator: Locator) {
  return locator.evaluate((el) => {
    const value = getComputedStyle(el).getPropertyValue("corner-top-left-shape").trim();
    if (value === "superellipse(2)") return "squircle";
    if (value === "superellipse(1)") return "round";
    return value;
  });
}

// SPEC §13.4, D-190: rounded corners are squircles where the browser has
// corner-shape; circles and pills (rounded-full, porthole) stay round. Guards
// the global rule and the rounded-full extension in globals.css.
test("Hjørner: kort er squircles, avatarer er runde", async ({ page }, testInfo) => {
  await signUpWithClub(page, newUser(testInfo, "hjorner"), clubName(testInfo, "Hjørneklub"));
  // E2E runs in Chromium, which has corner-shape; fail loudly if that changes.
  expect(await page.evaluate(() => CSS.supports("corner-shape", "superellipse(2)"))).toBe(true);

  await settingsLink(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Indstillinger" })).toBeAttached();
  const account = page.getByRole("region", { name: "Konto" });

  await expect.poll(() => cornerShape(account.getByRole("list"))).toBe("squircle");
  await expect.poll(() => cornerShape(account.locator(".porthole").first())).toBe("round");
});
