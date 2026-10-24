import { expect, test } from "./fixtures";
import { clubName, logOut, mainNav, newUser, signUpWithClub } from "./support/app";
import { isMobile } from "./support/round2";

/**
 * "Log ud" in the desktop sidebar, under the user row (SPEC §8.1, D-159):
 * logging out needs no trip to Profil. The mobile bottom nav has no room, so
 * there Log ud stays on Profil.
 */
test("Log ud fra sidebaren på desktop, fra Profil på mobil", async ({ page }, testInfo) => {
  await signUpWithClub(page, newUser(testInfo, "sidebarud"), clubName(testInfo, "Udklub"));
  const navLogout = mainNav(page).getByRole("button", { name: "Log ud" });

  if (isMobile(testInfo)) {
    await expect(navLogout).toHaveCount(0);
    await logOut(page);
  } else {
    await navLogout.click();
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { level: 1, name: "Log ind" })).toBeVisible();
});
