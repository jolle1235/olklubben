import { expect, test } from "./fixtures";
import {
  clubName,
  expectHydrated,
  mainNav,
  newUser,
  readInvitePath,
  signUpWithClub,
} from "./support/app";
import { insertEvent } from "./support/db";
import {
  allMemberMenuButtons,
  chooseMemberAction,
  confirmMemberAction,
  dangerZone,
  joinClub,
  memberMenuButton,
  memberRow,
  openMemberMenu,
} from "./support/members";

/**
 * Klubbens medlemmer (SPEC §5.1, §7.4, §7.5, §9.8; E2, E3, E15, E16; D-102,
 * D-103, D-110): the admins' '⋯' menu, leaving, deleting the club and the
 * club info. Two browsers: the admin and a member who joins by the link.
 */

const CLUB_404 = "Den her øl er vist drukket.";

test.describe("Medlemsadministration", () => {
  test("admin gør et medlem til admin; den nye admin fjerner den gamles rolle; selv-nedgradering", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "kaptajn");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Roller"));
    const invitePath = await readInvitePath(page);
    const memberPage = await openPage();
    const member = newUser(testInfo, "styrmand");
    await joinClub(memberPage, member, invitePath, clubId);

    // A plain member has no menu.
    await memberPage.goto(`/c/${clubId}/club`);
    await expect(memberRow(memberPage, member.name)).toBeVisible();
    await expect(allMemberMenuButtons(memberPage)).toHaveCount(0);

    // The admin promotes the member (a default confirmation, §15.1).
    await page.goto(`/c/${clubId}/club`);
    await confirmMemberAction(page, member.name, "Gør til admin", `Gør ${member.name} til admin?`);
    await expect(page.getByText(`${member.name} er nu admin`)).toBeVisible();
    await expect(memberRow(page, member.name).getByText("Admin", { exact: true })).toBeVisible();
    // Focus goes back to the member's '⋯' (SPEC §15.2).
    await expect(memberMenuButton(page, member.name)).toBeFocused();

    // The new admin sees the menus and takes the old admin's role.
    await memberPage.reload();
    await expect(allMemberMenuButtons(memberPage)).toHaveCount(2);
    await confirmMemberAction(
      memberPage,
      admin.name,
      "Fjern admin-rollen",
      `Fjern ${admin.name}s admin-rolle?`,
    );
    await expect(memberPage.getByText(`${admin.name} er ikke længere admin`)).toBeVisible();

    // The old admin is now a plain member: no menus, and /club/edit is a real 404.
    await page.reload();
    await expect(allMemberMenuButtons(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Rediger klubinfo" })).toHaveCount(0);
    const editResponse = await page.goto(`/c/${clubId}/club/edit`);
    expect(editResponse?.status()).toBe(404);

    // The last admin cannot take their own role: the item is disabled with the reason.
    await memberPage.goto(`/c/${clubId}/club`);
    const ownMenu = await openMemberMenu(memberPage, member.name);
    const ownDemote = ownMenu.getByRole("menuitem", { name: "Fjern min admin-rolle" });
    await expect(ownDemote).toHaveAttribute("aria-disabled", "true");
    await expect(ownMenu).toContainText("Klubben skal have mindst én admin.");
    await memberPage.keyboard.press("Escape");

    // With two admins again, taking your own role is allowed (with a confirmation).
    await confirmMemberAction(
      memberPage,
      admin.name,
      "Gør til admin",
      `Gør ${admin.name} til admin?`,
    );
    await confirmMemberAction(
      memberPage,
      member.name,
      "Fjern min admin-rolle",
      "Fjern din admin-rolle?",
    );
    await expect(memberPage.getByText("Du er ikke længere admin")).toBeVisible();
    await expect(allMemberMenuButtons(memberPage)).toHaveCount(0);
  });

  test("admin fjerner et medlem, hvis næste skridt i klubben giver 404 (E16)", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "bestyrer");
    const name = clubName(testInfo, "Fjern");
    const clubId = await signUpWithClub(page, admin, name);
    const invitePath = await readInvitePath(page);
    const memberPage = await openPage();
    const member = newUser(testInfo, "smutter");
    await joinClub(memberPage, member, invitePath, clubId);

    await page.goto(`/c/${clubId}/club`);
    await chooseMemberAction(page, member.name, "Fjern fra klubben");
    const dialog = page.getByRole("alertdialog", { name: `Fjern ${member.name} fra klubben?` });
    await expect(dialog).toContainText(`${member.name} mister adgangen til ${name} med det samme.`);
    await dialog.getByRole("button", { name: "Fjern fra klubben" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`${member.name} er fjernet fra klubben`)).toBeVisible();
    await expect(memberRow(page, member.name)).toHaveCount(0);

    // The removed member still has the app open: the next club page is a 404.
    await mainNav(memberPage).getByRole("link", { name: "Kalender" }).click();
    await expect(memberPage.getByRole("heading", { level: 1, name: CLUB_404 })).toBeVisible();
    await memberPage.getByRole("link", { name: "Gå til forsiden" }).click();
    await expect(memberPage).toHaveURL(/\/onboarding$/);
  });

  test("den sidste admin kan ikke gå; det eneste medlem får tilbudt at slette; et medlem forlader klubben", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "ensom");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Farezone"));
    const invitePath = await readInvitePath(page);

    // The only member (E3): no "Forlad klubben", the delete offer instead.
    await page.goto(`/c/${clubId}/club`);
    const zone = dangerZone(page);
    await expect(zone).toContainText("Du er det eneste medlem.");
    await expect(zone.getByRole("button", { name: "Forlad klubben" })).toHaveCount(0);
    await expect(zone.getByRole("button", { name: "Slet klubben" })).toBeVisible();

    const memberPage = await openPage();
    const member = newUser(testInfo, "gaest");
    await joinClub(memberPage, member, invitePath, clubId);

    // The last admin (E2): the reason and the shortcut to the member list.
    await page.reload();
    await expect(zone).toContainText("Du er klubbens eneste admin.");
    await expect(zone.getByRole("button", { name: "Forlad klubben" })).toHaveCount(0);
    await zone.getByRole("link", { name: "Gør et medlem til admin" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/club#medlemmer$`));
    await expect(memberMenuButton(page, member.name)).toBeInViewport();

    // The member may leave: home (no clubs left → onboarding) with a toast (D-104).
    await memberPage.goto(`/c/${clubId}/club`);
    const leave = dangerZone(memberPage).getByRole("button", { name: "Forlad klubben" });
    await expectHydrated(leave);
    await leave.click();
    const dialog = memberPage.getByRole("alertdialog");
    await expect(dialog).toContainText("Du kan joine igen med invitationslinket.");
    await dialog.getByRole("button", { name: "Forlad klubben" }).click();
    await expect(memberPage).toHaveURL(/\/onboarding$/);
    await expect(memberPage.getByText("Du har forladt klubben.")).toBeVisible();

    // The admin's member list no longer has them.
    await page.reload();
    await expect(memberRow(page, member.name)).toHaveCount(0);
  });

  test("admin sletter klubben ved at skrive navnet; alle sendes hjem", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "nedlukker");
    const name = clubName(testInfo, "Slettes");
    const clubId = await signUpWithClub(page, admin, name);
    const invitePath = await readInvitePath(page);
    const memberPage = await openPage();
    const member = newUser(testInfo, "tilskuer");
    await joinClub(memberPage, member, invitePath, clubId);
    await insertEvent({
      clubId,
      createdByEmail: admin.email,
      title: "Sidste smagning",
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      placeName: "Hos Nedlukkeren",
    });

    await page.goto(`/c/${clubId}/club`);
    const open = dangerZone(page).getByRole("button", { name: "Slet klubben" });
    await expectHydrated(open);
    await open.click();
    const dialog = page.getByRole("alertdialog", { name: `Slet ${name}?` });
    await expect(dialog).toContainText(
      "Alt i klubben bliver slettet permanent: 1 event og 1 sted. Medlemmernes konti bliver ikke slettet.",
    );
    const confirm = dialog.getByRole("button", { name: "Slet klubben" });
    const nameField = dialog.getByLabel("Skriv klubbens navn for at bekræfte");
    await expect(confirm).toBeDisabled();
    await nameField.fill(name.slice(0, -1));
    await expect(confirm).toBeDisabled();
    // Case and spacing do not matter (D-103).
    await nameField.fill(`  ${name.toUpperCase()} `);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText("Klubben er slettet.")).toBeVisible();

    // The member's next request to the club is a 404 (E16).
    const response = await memberPage.goto(`/c/${clubId}`);
    expect(response?.status()).toBe(404);
    await expect(memberPage.getByRole("heading", { level: 1, name: CLUB_404 })).toBeVisible();
  });

  test("admin retter klubinfo; et medlem har ingen menu, og /club/edit giver 404", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "redaktoer");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Gammelt navn"));
    const invitePath = await readInvitePath(page);
    const newName = clubName(testInfo, "Nyt navn");

    await page.goto(`/c/${clubId}/club`);
    await page.getByRole("link", { name: "Rediger klubinfo" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Rediger klubinfo" })).toBeVisible();

    // A blank name is refused in the form (the shared schema), and the field gets focus.
    const nameField = page.getByLabel("Klubbens navn");
    const description = page.getByLabel("Beskrivelse");
    await nameField.fill("   ");
    await page.getByRole("button", { name: "Gem", exact: true }).click();
    await expect(nameField).toHaveAttribute("aria-invalid", "true");
    await expect(nameField).toBeFocused();
    await expect(page.getByText("Giv klubben et navn.")).toBeVisible();

    await nameField.fill(`  ${newName}  `);
    await description.fill("Vi smager øl.\nHver fredag.");
    await page.getByRole("button", { name: "Gem", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/club$`));
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    await expect(page.getByText(/Vi smager øl\.\s*Hver fredag\./)).toBeVisible();
    // The ClubSwitcher (one club: a link to the club page) shows the new name too.
    await expect(
      page.getByRole("link", { name: /^Klubbens side:/ }).filter({ visible: true }),
    ).toContainText(newName);

    const memberPage = await openPage();
    const member = newUser(testInfo, "laeser");
    await joinClub(memberPage, member, invitePath, clubId);
    await memberPage.goto(`/c/${clubId}/club`);
    await expect(memberPage.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    await expect(allMemberMenuButtons(memberPage)).toHaveCount(0);
    await expect(memberPage.getByRole("link", { name: "Rediger klubinfo" })).toHaveCount(0);
    await expect(dangerZone(memberPage).getByRole("button", { name: "Slet klubben" })).toHaveCount(
      0,
    );
    const response = await memberPage.goto(`/c/${clubId}/club/edit`);
    expect(response?.status()).toBe(404);
    await expect(memberPage.getByRole("heading", { level: 1, name: CLUB_404 })).toBeVisible();
  });
});
