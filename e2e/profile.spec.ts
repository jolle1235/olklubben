import { expect, test } from "./fixtures";
import {
  clubName,
  expectOverview,
  fillLogInForm,
  logIn,
  memberRows,
  newUser,
  profileLink,
  signUpWithClub,
} from "./support/app";
import { addGoogleAccount, insertBeer, insertEvent, insertRating } from "./support/db";
import { makeGoogleOnly } from "./support/members";
import { isMobile } from "./support/round2";

/**
 * Profil (SPEC §9.8; D-105, D-106): the nickname shown everywhere (and the
 * official name on the member list and the profile), and "Skift password",
 * which keeps this device logged in and logs every other device out.
 */

test.describe("Profil: kælenavn og password", () => {
  test("et kælenavn vises overalt, med det officielle navn på medlemslisten, og kan ryddes", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "skipper");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Kælenavne"));
    const eventId = await insertEvent({
      clubId,
      createdByEmail: user.email,
      title: "Kaptajnens smagning",
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      placeName: "Hos Kaptajnen",
    });
    const beerId = await insertBeer({ clubId, createdByEmail: user.email, name: "Skumtoppen" });
    await insertRating({ beerId, email: user.email, value: 9 });

    await profileLink(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    const nickname = page.getByLabel("Kælenavn");
    await nickname.fill("  Kaptajnen  ");
    // The live preview: how the member list will show you.
    await expect(page.getByText("Sådan ser de andre dig:")).toContainText(
      `Kaptajnen (${user.name})`,
    );
    await page.getByRole("button", { name: "Gem profil" }).click();
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    await expect(nickname).toHaveValue("Kaptajnen");

    const identity = page.getByRole("region", { name: "Din konto" });
    await expect(identity).toContainText("Kaptajnen");
    await expect(identity).toContainText(`(${user.name})`);
    if (!isMobile(testInfo)) {
      // The sidebar's user row (D-093) shows the nickname.
      await expect(profileLink(page)).toContainText("Kaptajnen");
    }

    // The member list shows both; the event, the beer and its ratings show the nickname.
    await page.goto(`/c/${clubId}/club`);
    await expect(memberRows(page).filter({ hasText: "(dig)" })).toContainText(
      `Kaptajnen (${user.name})`,
    );
    await page.goto(`/c/${clubId}/events/${eventId}`);
    await expect(page.getByText(/Oprettet af\s*Kaptajnen/)).toBeVisible();
    await page.goto(`/c/${clubId}/beers/${beerId}`);
    await expect(page.getByText(/Tilføjet af Kaptajnen/)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "(dig)" })).toContainText(
      "Kaptajnen",
    );

    // Clearing the nickname brings the name back everywhere.
    await page.goto(`/c/${clubId}/profile`);
    await page.getByLabel("Kælenavn").fill("");
    await page.getByRole("button", { name: "Gem profil" }).click();
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    await expect(page.getByRole("region", { name: "Din konto" })).not.toContainText("Kaptajnen");
    await page.goto(`/c/${clubId}/club`);
    const me = memberRows(page).filter({ hasText: "(dig)" });
    await expect(me).toContainText(user.name);
    await expect(me).not.toContainText("Kaptajnen");
  });

  test("skift password: forkert nuværende fokuserer feltet; ellers bliver man logget ind her og ud alle andre steder", async ({
    page,
    openPage,
  }, testInfo) => {
    const user = newUser(testInfo, "skifter");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Passwordskift"));

    // The same account on another device.
    const otherDevice = await openPage();
    await logIn(otherDevice, user);
    await expectOverview(otherDevice, clubId);

    await page.goto(`/c/${clubId}/profile`);
    const current = page.getByLabel("Nuværende password");
    const newPassword = `${user.password}-ny`;
    await current.fill("helt-forkert-123");
    await page.getByLabel("Nyt password", { exact: true }).fill(newPassword);
    await page.getByLabel("Gentag nyt password").fill(newPassword);
    await page.getByRole("button", { name: "Skift password" }).click();
    await expect(page.getByText("Det nuværende password er forkert.")).toBeVisible();
    await expect(current).toHaveAttribute("aria-invalid", "true");
    await expect(current).toBeFocused();
    // Passwords are never sent back to the form.
    await expect(page.getByLabel("Nyt password", { exact: true })).toHaveValue("");

    await current.fill(user.password);
    await page.getByLabel("Nyt password", { exact: true }).fill(newPassword);
    await page.getByLabel("Gentag nyt password").fill(newPassword);
    await page.getByRole("button", { name: "Skift password" }).click();
    await expect(
      page.getByText("Dit password er skiftet. Dine andre enheder er logget ud."),
    ).toBeVisible();

    // This device stays logged in…
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();

    // …the other one is logged out, and only the new password works.
    await otherDevice.reload();
    await expect(otherDevice).toHaveURL(/\/login\?next=/);
    await fillLogInForm(otherDevice, user);
    await expect(otherDevice.getByText("Forkert email eller password.")).toBeVisible();
    await fillLogInForm(otherDevice, { email: user.email, password: newPassword });
    await expect(otherDevice).toHaveURL(new RegExp(`/c/${clubId}$`));
  });

  test("Google-konti får en forklaring i stedet for 'Skift password'", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "googler");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Google"));

    // Password and Google: the form is there.
    await addGoogleAccount(user.email);
    await page.goto(`/c/${clubId}/profile`);
    await expect(page.getByRole("heading", { name: "Skift password" })).toBeVisible();

    // Google only: an explanation, no form.
    await makeGoogleOnly(user.email);
    await page.reload();
    await expect(
      page.getByText("Du logger ind med Google, så du har ikke brug for et password."),
    ).toBeVisible();
    await expect(page.getByLabel("Nuværende password")).toHaveCount(0);
  });
});
