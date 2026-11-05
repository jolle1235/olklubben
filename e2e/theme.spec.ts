import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { clubName, newUser, profileLink, signUpWithClub } from "./support/app";

/** tokens.css sets color-scheme per theme, so it tells which theme is shown. */
function shownTheme(page: Page) {
  return page.locator("html").evaluate((html) => getComputedStyle(html).colorScheme);
}

// SPEC §13.2, D-171: a choice is data-theme on <html>; System is no attribute.
test("Udseende: Mørkt huskes, System følger enheden", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signUpWithClub(page, newUser(testInfo, "tema"), clubName(testInfo, "Temaklub"));
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");
  await expect.poll(() => shownTheme(page)).toBe("light");

  await profileLink(page).click();
  const appearance = page.getByRole("group", { name: "Udseende" });
  await expect(appearance.getByRole("button", { name: "System" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await appearance.getByRole("button", { name: "Mørkt" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(appearance.getByRole("button", { name: "Mørkt" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => shownTheme(page)).toBe("dark");

  // The server HTML has no data-theme: the head script must set it before the first paint.
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => shownTheme(page)).toBe("dark");

  await appearance.getByRole("button", { name: "System" }).click();
  await expect(html).not.toHaveAttribute("data-theme");
  await expect.poll(() => shownTheme(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => shownTheme(page)).toBe("dark");
});
