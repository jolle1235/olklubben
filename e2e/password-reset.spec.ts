import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { addGoogleAccount, countResetTokens, expireResetTokens } from "./support/db";
import { resetPathFrom, waitForEmail } from "./support/outbox";
import {
  clubName,
  createClub,
  expectOverview,
  fillLogInForm,
  logIn,
  memberRows,
  newUser,
  readInvitePath,
  signUp,
  signUpWithClub,
  type TestUser,
} from "./support/app";

/** "Glemt password" by email (dev outbox, D-024) and the admin's one-time link (SPEC §6.4, D-017). */

const EXPIRED_HEADING = "Linket er udløbet eller allerede brugt";

async function requestResetEmail(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Glemt password?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Glemt password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(page.getByText(/Hvis emailen findes, har vi sendt et link/)).toBeVisible();
}

async function chooseNewPassword(page: Page, password: string) {
  await expect(page.getByRole("heading", { level: 1, name: "Vælg et nyt password" })).toBeVisible();
  await page.getByLabel("Nyt password").fill(password);
  await page.getByLabel("Gentag password").fill(password);
  await page.getByRole("button", { name: "Gem nyt password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);
  await expect(page.getByText("Dit password er opdateret. Log ind med det nye.")).toBeVisible();
}

/** The admin's key button on the member list → "Lav link". Returns the dialog. */
async function openResetDialog(page: Page, clubId: string, memberName: string) {
  if (!page.url().endsWith(`/c/${clubId}/club`)) await page.goto(`/c/${clubId}/club`);
  await page.getByRole("button", { name: `Lav nulstillingslink til ${memberName}` }).click();
  const dialog = page.getByRole("dialog", { name: `Nulstillingslink til ${memberName}` });
  await dialog.getByRole("button", { name: "Lav link" }).click();
  return dialog;
}

/** Makes a reset link for the member, reads it and closes the dialog. */
async function makeResetLink(page: Page, clubId: string, memberName: string): Promise<string> {
  const dialog = await openResetDialog(page, clubId, memberName);
  const linkField = dialog.getByLabel("Nulstillingslink", { exact: true });
  await expect(linkField).toHaveValue(/\/reset-password\?token=/);
  // The new link gets focus (SPEC §15.2), not the dialog itself.
  await expect(linkField).toBeFocused();
  await expect(dialog).toContainText(`Del det kun med ${memberName}.`);
  const url = new URL(await linkField.inputValue());
  await dialog.getByRole("button", { name: "Luk" }).first().click();
  await expect(dialog).toBeHidden();
  return `${url.pathname}${url.search}`;
}

/** A new user joins the club through its invitation link, in their own browser context. */
async function joinWithNewUser(
  memberPage: Page,
  member: TestUser,
  invitePath: string,
  clubId: string,
) {
  await signUp(memberPage, member, { next: invitePath });
  await memberPage.getByRole("button", { name: "Join klub" }).click();
  await expectOverview(memberPage, clubId);
}

/** Signs up a user without clubs and logs out again (footer on /onboarding). */
async function signUpAndLogOut(page: Page, user: TestUser) {
  await signUp(page, user);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Log ud" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe("Nulstilling af password", () => {
  test("glemt password via email: det nye password virker, og linket kan kun bruges én gang", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "glemsom");
    await signUpAndLogOut(page, user);

    // An unknown email gets exactly the same answer (§6.4).
    await requestResetEmail(page, `ukendt-${user.email}`);
    await requestResetEmail(page, user.email);

    const email = await waitForEmail(user.email, /Nulstil dit password/);
    const resetPath = resetPathFrom(email);

    await page.goto(resetPath);
    const newPassword = `${user.password}-ny`;
    await chooseNewPassword(page, newPassword);

    // The old password no longer works; the message stays generic (§6.3).
    await fillLogInForm(page, user);
    await expect(page.getByText("Forkert email eller password.")).toBeVisible();

    await logIn(page, { email: user.email, password: newPassword });
    await expect(page).toHaveURL(/\/onboarding$/);

    // Single use.
    await page.goto(resetPath);
    await expect(page.getByRole("heading", { level: 1, name: EXPIRED_HEADING })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bed om et nyt link" })).toBeVisible();
  });

  test("en invitation overlever 'Glemt password': linket bærer next, og man lander på join", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "glemvaert");
    const name = clubName(testInfo, "Glemklub");
    await signUpWithClub(page, admin, name);
    const invitePath = await readInvitePath(page);
    const encodedInvite = encodeURIComponent(invitePath);

    const friendPage = await openPage();
    const friend = newUser(testInfo, "glemven");
    await signUpAndLogOut(friendPage, friend);

    // Invitation → Log ind → Glemt password?, all carrying ?next= (§6.5).
    await friendPage.goto(invitePath);
    await friendPage.getByRole("link", { name: "Log ind" }).click();
    await expect(friendPage).toHaveURL(new RegExp(`/login\\?next=${encodedInvite}$`));
    await friendPage.getByRole("link", { name: "Glemt password?" }).click();
    await expect(friendPage).toHaveURL(new RegExp(`/forgot-password\\?next=${encodedInvite}$`));
    await friendPage.getByLabel("Email").fill(friend.email);
    await friendPage.getByRole("button", { name: "Send link" }).click();
    await expect(friendPage.getByText(/Hvis emailen findes, har vi sendt et link/)).toBeVisible();

    // The email link (opened in any browser) carries the invitation.
    const email = await waitForEmail(friend.email, /Nulstil dit password/);
    const resetPath = resetPathFrom(email);
    expect(resetPath).toContain(`&next=${encodedInvite}`);

    await friendPage.goto(resetPath);
    const newPassword = `${friend.password}-ny`;
    await expect(
      friendPage.getByRole("heading", { level: 1, name: "Vælg et nyt password" }),
    ).toBeVisible();
    await friendPage.getByLabel("Nyt password").fill(newPassword);
    await friendPage.getByLabel("Gentag password").fill(newPassword);
    await friendPage.getByRole("button", { name: "Gem nyt password" }).click();
    await expect(friendPage).toHaveURL(new RegExp(`/login\\?reset=1&next=${encodedInvite}$`));
    await expect(
      friendPage.getByText("Dit password er opdateret. Log ind med det nye."),
    ).toBeVisible();

    await fillLogInForm(friendPage, { email: friend.email, password: newPassword });
    await expect(friendPage).toHaveURL(new RegExp(`${invitePath}$`));
    await expect(friendPage.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(friendPage.getByRole("button", { name: "Join klub" })).toBeVisible();
  });

  test("et udløbet, ugyldigt eller manglende token giver en venlig besked", async ({
    page,
  }, testInfo) => {
    for (const path of ["/reset-password", "/reset-password?token=findes-ikke"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: EXPIRED_HEADING })).toBeVisible();
    }

    const user = newUser(testInfo, "udloebet");
    await signUpAndLogOut(page, user);
    await requestResetEmail(page, user.email);
    const resetPath = resetPathFrom(await waitForEmail(user.email, /Nulstil dit password/));

    expect(await expireResetTokens(user.email)).toBeGreaterThan(0);
    await page.goto(resetPath);
    await expect(page.getByRole("heading", { level: 1, name: EXPIRED_HEADING })).toBeVisible();
    await page.getByRole("link", { name: "Bed om et nyt link" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("admin laver et engangslink til et medlem, som logger ind med sit nye password", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "admin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Nulstil"));
    const invitePath = await readInvitePath(page);

    const memberPage = await openPage();
    const member = newUser(testInfo, "glemmer");
    await joinWithNewUser(memberPage, member, invitePath, clubId);

    // The admin makes the link from the member list, not for themselves.
    await page.goto(`/c/${clubId}/club`);
    await expect(
      memberRows(page)
        .filter({ hasText: "(dig)" })
        .getByRole("button", { name: /nulstillingslink/i }),
    ).toHaveCount(0);
    const firstLink = await makeResetLink(page, clubId, member.name);
    // "Lav link" again revokes the previous link, like a new invitation code.
    const resetPath = await makeResetLink(page, clubId, member.name);
    expect(resetPath).not.toBe(firstLink);

    const resetPage = await openPage();
    await resetPage.goto(firstLink);
    await expect(resetPage.getByRole("heading", { level: 1, name: EXPIRED_HEADING })).toBeVisible();

    // A "Glemt password" email does not revoke the admin's link…
    await requestResetEmail(resetPage, member.email);
    const emailPath = resetPathFrom(await waitForEmail(member.email, /Nulstil dit password/));
    expect(await countResetTokens(member.email)).toBe(2);

    // The member opens the admin's link logged out (they forgot the password) and picks a new one.
    await resetPage.goto(resetPath);
    const newPassword = `${member.password}-ny`;
    await chooseNewPassword(resetPage, newPassword);

    // …but a completed reset revokes every other reset link of the account.
    expect(await countResetTokens(member.email)).toBe(0);
    await resetPage.goto(emailPath);
    await expect(resetPage.getByRole("heading", { level: 1, name: EXPIRED_HEADING })).toBeVisible();

    await logIn(resetPage, { email: member.email, password: newPassword });
    await expectOverview(resetPage, clubId);

    // A reset logs the account out everywhere else (D-030); the page is kept as ?next=.
    await memberPage.reload();
    await expect(memberPage).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(`/c/${clubId}`)}$`),
    );
  });

  test("admin kan ikke lave et nulstillingslink til medlemmer af andre klubber eller Google-brugere", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "admin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Grænse"));
    const invitePath = await readInvitePath(page);

    // One member also has a club of their own, which the admin does not run.
    const travellerPage = await openPage();
    const traveller = newUser(testInfo, "rejsende");
    await joinWithNewUser(travellerPage, traveller, invitePath, clubId);
    await createClub(travellerPage, clubName(testInfo, "Egen"));

    // Another member logs in with Google as well (E19 account linking).
    const googlePage = await openPage();
    const googleUser = newUser(testInfo, "google");
    await joinWithNewUser(googlePage, googleUser, invitePath, clubId);
    await addGoogleAccount(googleUser.email);

    for (const member of [traveller, googleUser]) {
      const dialog = await openResetDialog(page, clubId, member.name);
      // One generic answer for both reasons: it never mentions other clubs (§3.3).
      await expect(dialog).toContainText(
        `Du kan ikke lave et nulstillingslink til ${member.name}. Bed ${member.name} om at bruge "Glemt password" eller logge ind med Google.`,
      );
      await expect(dialog.getByLabel("Nulstillingslink", { exact: true })).toHaveCount(0);
      expect(await countResetTokens(member.email)).toBe(0);
      await dialog.getByRole("button", { name: "Annuller" }).first().click();
      await expect(dialog).toBeHidden();
    }
  });
});
