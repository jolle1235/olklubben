import { expect, test } from "./fixtures";
import { setRole } from "./support/db";
import {
  clubName,
  expectOverview,
  fillLogInForm,
  logOut,
  memberRows,
  newUser,
  readInvitePath,
  signUp,
  signUpWithClub,
} from "./support/app";

/** Invitations and join (SPEC §7.2–7.3, §10.7, E17, E18). */

const E18_HEADING = "Koden virker ikke længere";

test.describe("Invitationer", () => {
  test("ugyldige og ukendte koder giver E18, både i formularen og som link", async ({
    page,
  }, testInfo) => {
    // Logged out, malformed code: E18 without asking anyone to log in first.
    await page.goto("/join/ikke-en-kode");
    await expect(page.getByRole("heading", { level: 1, name: E18_HEADING })).toBeVisible();
    await expect(page.getByText("Spørg efter et nyt link.")).toBeVisible();

    const user = newUser(testInfo, "gaetter");
    await signUp(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);

    // The join form rejects a malformed code inline …
    const codeField = page.getByLabel("Invitationskode");
    await codeField.fill("0O1I");
    await page.getByRole("button", { name: "Join en ølklub" }).click();
    await expect(codeField).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/onboarding$/);

    // … and a well-formed code that does not exist ends on E18 (case and dash ignored).
    await codeField.fill("zzzz-zzzz");
    await page.getByRole("button", { name: "Join en ølklub" }).click();
    await expect(page).toHaveURL(/\/join\/ZZZZZZZZ$/);
    await expect(page.getByRole("heading", { level: 1, name: E18_HEADING })).toBeVisible();
    await page.getByRole("link", { name: "Skriv en anden kode" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("et medlem, der åbner klubbens link, kommer direkte ind i klubben (E17)", async ({
    page,
  }, testInfo) => {
    const admin = newUser(testInfo, "medlemslink");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Allerede"));
    const invitePath = await readInvitePath(page);

    await page.goto(`/c/${clubId}/profile`);
    await page.goto(invitePath);
    await expectOverview(page, clubId);
  });

  test("en eksisterende bruger logger ind fra invitationen og fortsætter til join", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "loginvaert");
    const name = clubName(testInfo, "Loginklub");
    const clubId = await signUpWithClub(page, admin, name);
    const invitePath = await readInvitePath(page);

    const friendPage = await openPage();
    const friend = newUser(testInfo, "loginven");
    await signUp(friendPage, friend);
    await expect(friendPage).toHaveURL(/\/onboarding$/);
    await friendPage.getByRole("button", { name: "Log ud" }).click();
    await expect(friendPage).toHaveURL(/\/login$/);

    await friendPage.goto(invitePath);
    await friendPage.getByRole("link", { name: "Log ind" }).click();
    await expect(friendPage).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(invitePath)}$`),
    );
    await fillLogInForm(friendPage, friend);

    await expect(friendPage).toHaveURL(new RegExp(`${invitePath}$`));
    await expect(friendPage.getByRole("heading", { level: 1 })).toContainText(name);
    await friendPage.getByRole("button", { name: "Join klub" }).click();
    await expectOverview(friendPage, clubId);
  });

  test("Log ud på invitationen (forkert konto) kommer tilbage til den efter login", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "kontovaert");
    const name = clubName(testInfo, "Kontoklub");
    await signUpWithClub(page, admin, name);
    const invitePath = await readInvitePath(page);

    const friendPage = await openPage();
    const wrong = newUser(testInfo, "forkertkonto");
    await signUp(friendPage, wrong);
    await expect(friendPage).toHaveURL(/\/onboarding$/);
    const friend = newUser(testInfo, "rigtigkonto");
    await signUp(await openPage(), friend);

    await friendPage.goto(invitePath);
    await expect(friendPage.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(friendPage.getByText(`Logget ind som ${wrong.email}`)).toBeVisible();
    await friendPage.getByRole("button", { name: "Log ud" }).click();
    await expect(friendPage).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(invitePath)}$`),
    );

    await fillLogInForm(friendPage, friend);
    await expect(friendPage).toHaveURL(new RegExp(`${invitePath}$`));
    await expect(friendPage.getByText(`Logget ind som ${friend.email}`)).toBeVisible();
    await expect(friendPage.getByRole("button", { name: "Join klub" })).toBeVisible();
  });

  test("admin genererer en ny kode: det gamle link holder op med at virke, det nye virker", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "nykode");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Nykode"));
    const oldPath = await readInvitePath(page);

    await page.goto(`/c/${clubId}/club`);
    await page.getByRole("button", { name: "Generér ny kode" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Generér en ny kode?" });
    await dialog.getByRole("button", { name: "Generér ny kode" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Ny kode klar. Del det nye link 🍻")).toBeVisible();
    await expect(page.getByLabel("Invitationslink")).not.toHaveValue(new RegExp(`${oldPath}$`));
    const newPath = await readInvitePath(page);

    const friendPage = await openPage();
    const friend = newUser(testInfo, "nykodeven");
    await signUp(friendPage, friend);
    await expect(friendPage).toHaveURL(/\/onboarding$/);

    await friendPage.goto(oldPath);
    await expect(friendPage.getByRole("heading", { level: 1, name: E18_HEADING })).toBeVisible();

    await friendPage.goto(newPath);
    await friendPage.getByRole("button", { name: "Join klub" }).click();
    await expectOverview(friendPage, clubId);

    // A plain member can see and share the link, but not replace it or make reset links.
    await friendPage.goto(`/c/${clubId}/club`);
    await expect(friendPage.getByLabel("Invitationslink")).toHaveValue(new RegExp(`${newPath}$`));
    await expect(friendPage.getByRole("button", { name: "Kopiér link" })).toBeVisible();
    await expect(friendPage.getByRole("button", { name: "Generér ny kode" })).toHaveCount(0);
    await expect(friendPage.getByRole("button", { name: /nulstillingslink/i })).toHaveCount(0);
    await expect(memberRows(friendPage)).toHaveCount(2);
  });

  test("serveren afviser en ny kode fra en, der ikke længere er admin", async ({
    page,
  }, testInfo) => {
    const admin = newUser(testInfo, "degraderet");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Degraderet"));
    const invitePath = await readInvitePath(page);

    await page.goto(`/c/${clubId}/club`);
    await page.getByRole("button", { name: "Generér ny kode" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Generér en ny kode?" });
    await expect(dialog).toBeVisible();

    // Demoted while the dialog is open: hidden buttons are only UX (§4.4).
    await setRole(admin.email, clubId, "MEMBER");
    await dialog.getByRole("button", { name: "Generér ny kode" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Kun admins kan generere en ny kode.");
    await dialog.getByRole("button", { name: "Annuller" }).click();

    await page.reload();
    await expect(page.getByLabel("Invitationslink")).toHaveValue(new RegExp(`${invitePath}$`));
    await expect(page.getByRole("button", { name: "Generér ny kode" })).toHaveCount(0);
    await logOut(page);
  });
});
