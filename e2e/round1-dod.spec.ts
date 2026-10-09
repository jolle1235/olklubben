import { expect, test } from "./fixtures";
import {
  clubName,
  createClub,
  expectOverview,
  fillSignUpForm,
  logIn,
  logOut,
  memberRows,
  newUser,
  profileLink,
  readInvitePath,
  signUp,
  signUpWithClub,
} from "./support/app";

/**
 * Round 1's Definition of Done (SPEC §16.3):
 *   (a) new user: sign up → create club → Admin → Overblik → log out → log in → back in the club
 *   (b) second user: sign up via the invitation link → join → sees the club
 */

test.describe("Runde 1: Definition of Done", () => {
  test("(a) ny bruger opretter klub, bliver admin og lander i klubben efter log ud og log ind", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "grundlaegger");
    const name = clubName(testInfo, "Drengene");

    await signUp(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Velkommen ombord! 🍺" }),
    ).toBeVisible();
    await expect(page.getByText("Du er ikke medlem af nogen klub endnu.")).toBeVisible();

    const clubId = await createClub(page, name);

    // Overblik of a one-member club: the invite card comes first (SPEC §9.1).
    await expect(page.getByRole("heading", { name: "Inviter dine ølbrødre" })).toBeVisible();
    await expect(page.getByLabel("Invitationslink")).toHaveValue(/\/join\/[2-9A-HJKMNP-Z]{8}$/);
    await expect(
      page.getByRole("heading", { name: "Ingen kommende ølsmagninger endnu 🍺" }),
    ).toBeVisible();

    // Profil → Klubben: the creator is Admin.
    await profileLink(page).click();
    await page
      .getByRole("navigation", { name: "Klubber" })
      .getByRole("link", { name: /^Klubben/ })
      .click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const me = memberRows(page).filter({ hasText: "(dig)" });
    await expect(me).toContainText(user.name);
    await expect(me.getByText("Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generér ny kode" })).toBeVisible();

    await logOut(page);
    await logIn(page, user);
    await expectOverview(page, clubId);
  });

  test("(b) anden bruger åbner invitationslinket, opretter konto, joiner og ser klubben", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "vaert");
    const name = clubName(testInfo, "Bajerne");
    const clubId = await signUpWithClub(page, admin, name);
    const invitePath = await readInvitePath(page);

    // The friend opens the link logged out: a generic invitation, no club name (§6.5).
    const friendPage = await openPage();
    const friend = newUser(testInfo, "ven");
    await friendPage.goto(invitePath);
    await expect(
      friendPage.getByRole("heading", { level: 1, name: "Du er inviteret til en ølklub 🍺" }),
    ).toBeVisible();
    await expect(friendPage.getByText(name)).toHaveCount(0);

    // Opret konto keeps the invitation (?next=) and comes straight back (§6.5, §10.7).
    await friendPage.getByRole("link", { name: "Opret konto" }).click();
    await expect(friendPage).toHaveURL(
      new RegExp(`/signup\\?next=${encodeURIComponent(invitePath)}$`),
    );
    await expect(friendPage.getByText(/fortsætter du direkte til invitationen/)).toBeVisible();
    await fillSignUpForm(friendPage, friend);

    await expect(friendPage).toHaveURL(new RegExp(`${invitePath}$`));
    await expect(friendPage.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(friendPage.getByText("(1 medlem)")).toBeVisible();

    await friendPage.getByRole("button", { name: "Join klub" }).click();
    await expectOverview(friendPage, clubId);
    // Two members now: no invite card on Overblik any more.
    await expect(friendPage.getByRole("heading", { name: "Inviter dine ølbrødre" })).toHaveCount(0);

    // The friend is a member, not an admin.
    await friendPage.goto(`/c/${clubId}/club`);
    const friendRow = memberRows(friendPage).filter({ hasText: "(dig)" });
    await expect(friendRow).toContainText(friend.name);
    await expect(friendRow.getByText("Admin", { exact: true })).toHaveCount(0);

    // The admin's club page lists both.
    await page.goto(`/c/${clubId}/club`);
    await expect(page.getByText("2 medlemmer ·")).toBeVisible();
    await expect(memberRows(page)).toHaveCount(2);
    await expect(memberRows(page).filter({ hasText: friend.name })).toBeVisible();
  });
});
