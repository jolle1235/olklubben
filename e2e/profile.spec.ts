import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clubName,
  expectOverview,
  fillLogInForm,
  logIn,
  logOut,
  memberRows,
  newUser,
  profileLink,
  signUpWithClub,
} from "./support/app";
import {
  addGoogleAccount,
  backdateSessionCreatedAt,
  insertBeer,
  insertEvent,
  insertRating,
  latestSession,
} from "./support/db";
import { makeGoogleOnly } from "./support/members";
import { isMobile } from "./support/round2";

/**
 * Profil (SPEC §9.8; D-105, D-106, D-151, D-152): the nickname shown
 * everywhere (and the official name on the member list and the profile),
 * "Skift password" and "Skift email", which keep this device logged in and
 * log every other device out, and "Tilføj password" for Google-only accounts
 * right after a Google login. Google itself is not configured in E2E.
 */

/** A Profil card, a region named by its heading ("Email", "Skift password", …). */
function card(page: Page, heading: string) {
  return page.getByRole("region", { name: heading, exact: true });
}

test.describe("Profil: kælenavn, email og password", () => {
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
    const passwordCard = card(page, "Skift password");
    const current = passwordCard.getByLabel("Nuværende password");
    const newPassword = `${user.password}-ny`;
    await current.fill("helt-forkert-123");
    await passwordCard.getByLabel("Nyt password", { exact: true }).fill(newPassword);
    await passwordCard.getByLabel("Gentag nyt password").fill(newPassword);
    await passwordCard.getByRole("button", { name: "Skift password" }).click();
    await expect(passwordCard.getByText("Det nuværende password er forkert.")).toBeVisible();
    await expect(current).toHaveAttribute("aria-invalid", "true");
    await expect(current).toBeFocused();
    // Passwords are never sent back to the form.
    await expect(passwordCard.getByLabel("Nyt password", { exact: true })).toHaveValue("");

    await current.fill(user.password);
    await passwordCard.getByLabel("Nyt password", { exact: true }).fill(newPassword);
    await passwordCard.getByLabel("Gentag nyt password").fill(newPassword);
    await passwordCard.getByRole("button", { name: "Skift password" }).click();
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

  test("skift email: toast, profil og sidebar viser den nye email, som logger ind; den gamle gør ikke", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "flytter");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Emailskift"));
    const newEmail = newUser(testInfo, "flyttet").email;

    await profileLink(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    const emailCard = card(page, "Email");
    await expect(emailCard).toContainText(`Du logger ind med ${user.email}.`);
    // Typed with capitals: stored lowercase.
    await emailCard.getByLabel("Ny email", { exact: true }).fill(newEmail.toUpperCase());
    await emailCard.getByLabel("Gentag ny email").fill(newEmail);
    await emailCard.getByLabel("Nuværende password").fill(user.password);
    await emailCard.getByRole("button", { name: "Skift email" }).click();

    await expect(
      page.getByText("Din email er skiftet. Dine andre enheder er logget ud."),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Din konto" })).toContainText(newEmail);
    await expect(emailCard).toContainText(`Du logger ind med ${newEmail}.`);
    // The form starts over.
    await expect(emailCard.getByLabel("Ny email", { exact: true })).toHaveValue("");
    if (!isMobile(testInfo)) {
      // The sidebar's user row (D-093) shows the email.
      await expect(profileLink(page)).toContainText(newEmail);
    }

    // The old email no longer logs in; the new one does.
    await logOut(page);
    await fillLogInForm(page, user);
    await expect(page.getByText("Forkert email eller password.")).toBeVisible();
    await fillLogInForm(page, { email: newEmail, password: user.password });
    await expectOverview(page, clubId);
  });

  test("Google-konti: email følger Google, og lige efter et Google-login kan de tilføje et password", async ({
    page,
    openPage,
  }, testInfo) => {
    const user = newUser(testInfo, "googler");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Google"));

    // Password and Google: both forms are there.
    await addGoogleAccount(user.email);
    await page.goto(`/c/${clubId}/profile`);
    await expect(page.getByRole("heading", { name: "Skift password" })).toBeVisible();
    await expect(card(page, "Email").getByRole("button", { name: "Skift email" })).toBeVisible();

    // Google only. The session was created minutes ago (like right after a
    // Google login), so "Tilføj password" shows its form.
    await makeGoogleOnly(user.email);
    await page.reload();
    const emailCard = card(page, "Email");
    await expect(emailCard).toContainText(
      "Du logger ind med Google, så din email følger din Google-konto.",
    );
    await expect(emailCard.getByRole("textbox")).toHaveCount(0);
    const passwordCard = card(page, "Tilføj password");
    await expect(passwordCard).toContainText(
      "Vælg et password, så du også kan logge ind med email.",
    );
    await expect(passwordCard.getByLabel("Nuværende password")).toHaveCount(0);

    const newPassword = `${user.password}-ny`;
    await passwordCard.getByLabel("Nyt password", { exact: true }).fill(newPassword);
    await passwordCard.getByLabel("Gentag nyt password").fill(newPassword);
    await passwordCard.getByRole("button", { name: "Gem password" }).click();
    await expect(
      page.getByText(
        "Dit password er gemt. Nu kan du også logge ind med email og password. Dine andre enheder er logget ud.",
      ),
    ).toBeVisible();
    // The card is "Skift password" now, and the email can be changed.
    await expect(page.getByRole("heading", { name: "Skift password" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tilføj password" })).toHaveCount(0);
    await expect(card(page, "Email").getByRole("button", { name: "Skift email" })).toBeVisible();

    // Another device logs in with email and the new password.
    const otherDevice = await openPage();
    await logIn(otherDevice, { email: user.email, password: newPassword });
    await expectOverview(otherDevice, clubId);
  });

  test("en ren Google-konto med et Google-login over 10 minutter gammelt får forklaringen og ingen passwordfelter", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "gammelgoogle");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "GammelGoogle"));
    await addGoogleAccount(user.email);
    await makeGoogleOnly(user.email);
    const session = await latestSession(user.email);
    await backdateSessionCreatedAt(session.id, 11);

    await page.goto(`/c/${clubId}/profile`);
    const passwordCard = card(page, "Tilføj password");
    await expect(passwordCard).toContainText(
      "Af sikkerhedshensyn skal du have logget ind med Google for nylig, før du kan tilføje et password.",
    );
    await expect(passwordCard.getByLabel("Nyt password", { exact: true })).toHaveCount(0);
    await expect(passwordCard.getByRole("button", { name: "Gem password" })).toHaveCount(0);
    // Google is not configured in E2E, so there is no "Log ind med Google igen".
    await expect(passwordCard.getByRole("button", { name: "Log ind med Google igen" })).toHaveCount(
      0,
    );
  });
});
