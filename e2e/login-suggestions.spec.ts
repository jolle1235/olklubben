import { expect, test } from "./fixtures";
import { clubName, logOut, newUser, signUpWithClub } from "./support/app";

/**
 * Log ind (SPEC §6.3, D-157): the emails used on this device are offered
 * under the email field and in its <datalist>; tapping one fills the field
 * and moves to the password, and Enter logs in. An email that failed to log
 * in is not remembered.
 */
test("brugte emails foreslås, og Enter logger ind", async ({ page }, testInfo) => {
  const user = newUser(testInfo, "huske");
  await signUpWithClub(page, user, clubName(testInfo, "Huskeklub"));
  await logOut(page);

  const used = page.getByRole("button", { name: user.email.toLowerCase() });
  await expect(page.getByText("Brugt før:")).toBeVisible();
  await expect(used).toBeVisible();
  await expect(page.locator("datalist option")).toHaveCount(1);

  // A typo with a wrong password is not added.
  await page.getByLabel("Email").fill("tastefejl@example.test");
  await page.getByLabel("Password", { exact: true }).fill("forkert-password-1");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page.getByText("Forkert email eller password.")).toBeVisible();
  await expect(page.getByRole("button", { name: "tastefejl@example.test" })).toHaveCount(0);

  await page.getByLabel("Email").fill("");
  await used.click();
  await expect(page.getByLabel("Email")).toHaveValue(user.email.toLowerCase());
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type(user.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/c\//);
});
