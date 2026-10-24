import { expect, test } from "./fixtures";
import { clubName, mainNav, newUser, signUpWithClub } from "./support/app";
import { isMobile } from "./support/round2";

/**
 * "Log ud" in the desktop sidebar, under the user row (SPEC §8.1, D-159):
 * logging out needs no trip to Profil. On mobile the bottom nav has no room;
 * Log ud stays on Profil there.
 */
test("Log ud direkte fra sidebaren på desktop", async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), "Sidebaren findes kun på desktop.");
  await signUpWithClub(page, newUser(testInfo, "sidebarud"), clubName(testInfo, "Udklub"));

  await mainNav(page).getByRole("button", { name: "Log ud" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Log ind" })).toBeVisible();
});
