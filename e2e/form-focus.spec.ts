import { expect, test } from "./fixtures";
import { clubName, createClub, newUser, profileLink, signUp } from "./support/app";

/**
 * Keyboard use (SPEC §15.2): a validation error moves focus to the invalid
 * field, so its message is read out and the field can be fixed right away.
 * Every form is submitted with Enter on its submit button, without a mouse.
 */

test.describe("Fokus ved fejl i formularer", () => {
  test("en fejl flytter fokus til feltet i join, opret klub og profil", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "fokus");
    await signUp(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);

    // Join: a malformed code, checked in the browser.
    const codeField = page.getByLabel("Invitationskode");
    await codeField.fill("hello");
    await page.getByRole("button", { name: "Join en ølklub" }).press("Enter");
    await expect(codeField).toHaveAttribute("aria-invalid", "true");
    await expect(codeField).toBeFocused();

    // Create a club: a blank name, checked in the browser with the action's
    // schema (TG-021). The same error a second time focuses the field again.
    const nameField = page.getByLabel("Klubbens navn");
    const createButton = page.getByRole("button", { name: "Opret ølklub" });
    await nameField.fill("   ");
    await createButton.press("Enter");
    await expect(nameField).toHaveAttribute("aria-invalid", "true");
    await expect(nameField).toBeFocused();
    await createButton.press("Enter");
    await expect(nameField).toBeFocused();

    // Profil: an empty name, checked in the browser.
    await createClub(page, clubName(testInfo, "Fokus"));
    await profileLink(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    const profileName = page.getByLabel("Navn", { exact: true });
    await profileName.fill("");
    await page.getByRole("button", { name: "Gem profil" }).press("Enter");
    await expect(profileName).toHaveAttribute("aria-invalid", "true");
    await expect(profileName).toBeFocused();

    // Skift password: a wrong current password is checked by the server, and
    // its error moves focus to that field (D-056).
    const currentPassword = page.getByLabel("Nuværende password");
    await currentPassword.fill("forkert-password");
    await page.getByLabel("Nyt password", { exact: true }).fill(`${user.password}-ny`);
    await page.getByLabel("Gentag nyt password").fill(`${user.password}-ny`);
    await page.getByRole("button", { name: "Skift password" }).press("Enter");
    await expect(page.getByText("Det nuværende password er forkert.")).toBeVisible();
    await expect(currentPassword).toHaveAttribute("aria-invalid", "true");
    await expect(currentPassword).toBeFocused();
  });
});
