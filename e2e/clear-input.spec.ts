import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures";
import { expectHydrated, newUser, signUp } from "./support/app";

/**
 * The X that empties a single-line text field (D-167): only shown while the
 * field has text, and clearing leaves focus in the field.
 */

function clearButton(field: Locator): Locator {
  return field.locator("xpath=following-sibling::button[@aria-label='Ryd feltet']");
}

test.describe("Ryd feltet", () => {
  test("X'et rydder et kontrolleret og et ukontrolleret felt", async ({ page }, testInfo) => {
    const user = newUser(testInfo, "ryd");
    await signUp(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);

    // Controlled (React state) and uncontrolled (server action form).
    for (const label of ["Invitationskode", "Klubbens navn"]) {
      const field = page.getByLabel(label);
      const clear = clearButton(field);
      await expect(clear).toBeHidden();

      await field.fill("Forkert tekst");
      await expect(clear).toBeVisible();
      // CSS shows the X before React has hydrated; a click then does nothing.
      await expectHydrated(clear);
      await clear.click();

      await expect(field).toHaveValue("");
      await expect(field).toBeFocused();
      await expect(clear).toBeHidden();
    }

    // React saw the change: the code field, typed again, still validates.
    const codeField = page.getByLabel("Invitationskode");
    await codeField.fill("hello");
    await page.getByRole("button", { name: "Join en ølklub" }).press("Enter");
    await expect(codeField).toHaveAttribute("aria-invalid", "true");
  });
});
