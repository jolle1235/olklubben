import { expect, test } from "./fixtures";
import { clubName, newUser, profileLink, signUpWithClub } from "./support/app";

/**
 * Udseende on Profil (SPEC §9.8, §13.2, D-168): System | Lyst | Mørkt,
 * remembered per device. The choice switches at once, survives a hard reload
 * (set before the first paint) and "System" follows the device.
 */
test("Udseende: Mørkt huskes, System følger enheden", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signUpWithClub(page, newUser(testInfo, "tema"), clubName(testInfo, "Temaklub"));
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

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

  // Before the first paint: the server HTML has no data-theme; the head script sets it.
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "dark");

  await appearance.getByRole("button", { name: "System" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "dark");
});
