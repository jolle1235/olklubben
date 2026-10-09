import { expect, test } from "./fixtures";
import { clubName, fillLogInForm, newUser, profileLink, signUpWithClub } from "./support/app";
import { deleteSessions } from "./support/db";
import { isMobile } from "./support/round2";

/** Deep links through login (SPEC §6.5, §10.1) and the basic profile (§9.8, D-023). */

test.describe("Dybe links og profil", () => {
  test("et dybt link husker siden gennem login og lander på præcis den side", async ({
    page,
    openPage,
  }, testInfo) => {
    const user = newUser(testInfo, "dybtlink");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Dybtlink"));

    const freshPage = await openPage();
    const target = `/c/${clubId}/profile`;
    await freshPage.goto(target);
    await expect(freshPage).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(target)}$`));

    await fillLogInForm(freshPage, user);
    await expect(freshPage).toHaveURL(new RegExp(`${target}$`));
    await expect(freshPage.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();

    // /profile (D-023) goes to the Profil tab of the active club.
    await freshPage.goto("/profile");
    await expect(freshPage).toHaveURL(new RegExp(`${target}$`));
  });

  test("et dybt link overlever en forældet session-cookie (fx efter nulstilling)", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "foraeldet");
    const name = clubName(testInfo, "Forældet");
    const clubId = await signUpWithClub(page, user, name);

    // The browser still has a cookie, so the proxy lets the request through;
    // requireUser() must still keep the deep link (RETURN_TO_HEADER).
    await deleteSessions(user.email);
    const target = `/c/${clubId}/club`;
    await page.goto(target);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(target)}$`));

    await fillLogInForm(page, user);
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });

  test("Gem profil med en forældet session sender til login uden fejlbesked", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "gemforaeldet");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Gemforældet"));
    await page.goto(`/c/${clubId}/profile`);
    const nameField = page.getByLabel("Navn", { exact: true });
    await expect(nameField).toHaveValue(user.name);

    // Logged out everywhere (e.g. a password reset) while Profil is open: the
    // Server Action redirects to /login, and the form must not swallow that.
    await deleteSessions(user.email);
    await nameField.fill("Kaptajn Skum");
    await page.getByRole("button", { name: "Gem profil" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Log ind" })).toBeVisible();
    // A swallowed redirect shows the generic error toast about when /login
    // renders. Give it time to appear, then count once: a retrying
    // toHaveCount(0) would just wait for the toast to close by itself (4 s).
    await page.waitForTimeout(1_000);
    expect(await page.getByText(/Noget gik galt/).count()).toBe(0);
  });

  test("et usikkert next-link ignoreres efter login", async ({ page, openPage }, testInfo) => {
    const user = newUser(testInfo, "omdirigering");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Sikker"));

    const freshPage = await openPage();
    await freshPage.goto("/login?next=//evil.example/steal");
    await fillLogInForm(freshPage, user);
    await expect(freshPage).toHaveURL(new RegExp(`/c/${clubId}$`));
  });

  test("Profil er markeret i navigationen på profilen og klubbens side", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "profilnav");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Profilnav"));
    const nav = page.getByRole("navigation", { name: "Hovednavigation" });

    if (isMobile(testInfo)) {
      // The bottom nav keeps all five items (SPEC §8.1).
      await expect(nav.getByRole("link")).toHaveText([
        "Overblik",
        "Kalender",
        "Øl",
        "Sangbog",
        "Profil",
      ]);
    } else {
      // Desktop: four items in the list, and the user row is the way to Profil.
      await expect(nav.getByRole("listitem")).toHaveText(["Overblik", "Kalender", "Øl", "Sangbog"]);
      await expect(nav.getByRole("link", { name: "Profil", exact: true })).toHaveCount(0);
      await expect(profileLink(page)).toContainText(user.name);
      await expect(profileLink(page)).toContainText(user.email);
    }
    await expect(profileLink(page)).not.toHaveAttribute("aria-current");

    await profileLink(page).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/profile$`));
    await expect(profileLink(page)).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    await page.goto(`/c/${clubId}/club`);
    await expect(profileLink(page)).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("et nyt navn gemmes, ryddes op og overlever en genindlæsning", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "navneskift");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Navne"));

    await profileLink(page).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/profile$`));

    const nameField = page.getByLabel("Navn", { exact: true });
    await expect(nameField).toHaveValue(user.name);

    // Empty is rejected in the form.
    await nameField.fill("   ");
    await page.getByRole("button", { name: "Gem profil" }).click();
    await expect(nameField).toHaveAttribute("aria-invalid", "true");

    // Whitespace is cleaned up by the server (cleanUserName).
    await nameField.fill("  Kaptajn   Skum  ");
    await page.getByRole("button", { name: "Gem profil" }).click();
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    await expect(nameField).toHaveValue("Kaptajn Skum");

    await page.reload();
    await expect(page.getByLabel("Navn", { exact: true })).toHaveValue("Kaptajn Skum");
    await expect(
      page.getByRole("region", { name: "Din konto" }).getByText("Kaptajn Skum", { exact: true }),
    ).toBeVisible();

    // The member list uses the new name too.
    await page.goto(`/c/${clubId}/club`);
    await expect(page.getByRole("region", { name: "Medlemmer" })).toContainText("Kaptajn Skum");
  });
});
