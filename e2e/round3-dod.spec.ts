import { expect, test } from "./fixtures";
import {
  clubName,
  expectHydrated,
  mainNav,
  memberRows,
  newUser,
  profileLink,
  signUpWithClub,
} from "./support/app";
import { insertEvent, insertPlace } from "./support/db";
import { confirmMemberAction, dangerZone, memberRow } from "./support/members";
import { expectPlacePage, fillPlaceForm, ownersRegion, placePath } from "./support/places";
import {
  at,
  createEventViaForm,
  dayFromToday,
  expectNewBeerPage,
  expectRatingSaved,
  fillBeerForm,
  hostCheckbox,
  idFromUrl,
  joinClub,
  placeRadio,
  tapStars,
} from "./support/round2";

/**
 * Round 3's Definition of Done (SPEC §16.3 "Det er vores klub"): the app
 * works as the club's archive – members with nicknames, places with owners,
 * events at those places with hosts, upcoming and past tastings, the beer
 * catalogue – and the admins can run the club (D-094…D-110). The songbook
 * (task 3.1) is deferred (D-091). Through the real UI as an admin and an
 * ordinary member; SQL only for setup that is not the point of a test.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLUB_404 = "Den her øl er vist drukket.";

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

test.describe("Runde 3: Definition of Done", () => {
  test("(a) et medlem får et kælenavn og et sted; events på stedet får ejeren som vært", async ({
    page,
    openPage,
  }, testInfo) => {
    test.slow(); // Two sign-ups and five forms through `next dev`.
    const admin = newUser(testInfo, "r3admin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Arkivet"));
    const memberPage = await openPage();
    const member = newUser(testInfo, "r3medlem");
    await joinClub(page, memberPage, member, clubId);

    // The member picks a nickname on Profil (D-105).
    await profileLink(memberPage).click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    await memberPage.getByLabel("Kælenavn").fill("Skipperen");
    await expect(memberPage.getByText("Sådan ser de andre dig:")).toContainText(
      `Skipperen (${member.name})`,
    );
    await memberPage.getByRole("button", { name: "Gem profil" }).click();
    await expect(memberPage.getByText("Gemt ✓")).toBeVisible();

    // The admin's member list shows the nickname with the official name.
    await page.goto(`/c/${clubId}/club`);
    await expect(memberRow(page, "Skipperen")).toContainText(`Skipperen (${member.name})`);

    // Profil → Steder → Nyt sted, with an address and "Det er mit sted" (§9.4).
    await memberPage
      .getByRole("navigation", { name: "Klubber" })
      .getByRole("link", { name: /^Steder/ })
      .click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Steder" })).toBeVisible();
    await memberPage.getByRole("main").getByRole("link", { name: "Nyt sted" }).click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Nyt sted" })).toBeVisible();
    const address = "Havnegade 3, 8000 Aarhus C";
    await fillPlaceForm(memberPage, { name: "Skipperens kælder", address, mine: true });
    await memberPage.getByRole("button", { name: "Opret sted" }).click();
    const placeId = await expectPlacePage(memberPage, clubId, "Skipperens kælder");
    await expect(memberPage.getByText("Stedet er oprettet 📍")).toBeVisible();
    await expect(ownersRegion(memberPage).getByRole("listitem")).toContainText("Skipperen");

    // The admin finds it from the club page and creates an event there: the
    // place is pre-selected and its owner is suggested as host (D-098, D-099).
    await page.reload();
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Steder/ })
      .click();
    const card = page.getByRole("main").getByRole("link", { name: /Skipperens kælder/ });
    await expect(card).toContainText("Ejer: Skipperen");
    await card.click();
    await expectPlacePage(page, clubId, "Skipperens kælder");
    await page.getByRole("main").getByRole("link", { name: "Opret event her" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Opret event" })).toBeVisible();
    await expect(placeRadio(page, "Skipperens kælder")).toBeChecked();
    await expectHydrated(hostCheckbox(page, "Skipperen"));
    await expect(hostCheckbox(page, "Skipperen")).toBeChecked();
    await expect(hostCheckbox(page, `${admin.name} (dig)`)).not.toBeChecked();
    await expect(page.getByRole("group", { name: "Værter" })).toContainText(
      "Udfyldt med stedets ejere.",
    );
    await page.getByLabel("Titel").fill("Kældersmagning");
    await page.getByLabel("Dato").fill(dayFromToday(6));
    await page.getByLabel("Starttid").fill("19:00");
    await page.getByRole("button", { name: "Opret event" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/events/${UUID}$`));
    const eventId = idFromUrl(page);
    await expect(page.getByText("Skål! Eventet er oprettet 🍻")).toBeVisible();

    // The event page: the place links to its page, the address and the map
    // (D-101), the host by nickname and who created it.
    await expect(
      page.getByRole("link", { name: "Skipperens kælder", exact: true }),
    ).toHaveAttribute("href", `/c/${clubId}/places/${placeId}`);
    await expect(page.getByText(address, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Åbn i kort/ })).toHaveAttribute(
      "href",
      mapsUrl(address),
    );
    await expect(page.getByText("Vært: Skipperen")).toBeVisible();
    await expect(page.getByText(/Oprettet af/)).toContainText(admin.name);

    // The member hosts it without having created it, so they may edit it (D-098).
    await memberPage.goto(`/c/${clubId}/events/${eventId}`);
    await memberPage.getByRole("link", { name: "Rediger", exact: true }).click();
    await expect(
      memberPage.getByRole("heading", { level: 1, name: "Rediger event" }),
    ).toBeVisible();
    await expect(placeRadio(memberPage, "Skipperens kælder")).toBeChecked();
    await expect(hostCheckbox(memberPage, "Skipperen (dig)")).toBeChecked();
    await memberPage.getByLabel(/^Tema/).fill("Kælderøl");
    await memberPage.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(memberPage).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(memberPage.getByText("Tema: Kælderøl")).toBeVisible();

    // The place lists its tasting, and links back to Steder.
    await memberPage.goto(placePath(clubId, placeId));
    await expect(
      memberPage
        .getByRole("region", { name: /Ølsmagninger her/ })
        .getByRole("link", { name: /Kældersmagning/ }),
    ).toBeVisible();

    // A tasting somewhere new, created inline with "＋ Nyt sted": the place
    // has no owners, so the one creating it hosts it; no address, so no map
    // link, but a way to add one.
    const otherId = await createEventViaForm(memberPage, clubId, {
      title: "Havneaften",
      date: dayFromToday(12),
      place: { new: "Bodegaen ved havnen" },
    });
    await expect(memberPage.getByText("Vært: Skipperen")).toBeVisible();
    await expect(memberPage.getByRole("link", { name: /Åbn i kort/ })).toHaveCount(0);
    await expect(memberPage.getByRole("link", { name: "Tilføj adresse" })).toBeVisible();
    await memberPage.getByRole("link", { name: "Bodegaen ved havnen", exact: true }).click();
    await expectPlacePage(memberPage, clubId, "Bodegaen ved havnen");
    await expect(ownersRegion(memberPage)).toContainText("Ingen ejere.");
    await expect(
      memberPage.getByRole("region", { name: /Ølsmagninger her/ }).getByRole("link"),
    ).toHaveAttribute("href", `/c/${clubId}/events/${otherId}`);
    await memberPage.getByRole("link", { name: "Alle steder" }).click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Steder" })).toBeVisible();
    await expect(memberPage.getByRole("main").getByRole("listitem")).toHaveCount(2);
  });

  test("(b) en afholdt smagning med øl og rating står under Tidligere på Overblik og i Kalender, også efter stedet er arkiveret", async ({
    page,
    openPage,
  }, testInfo) => {
    test.slow();
    const admin = newUser(testInfo, "r3histadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Historie"));
    const memberPage = await openPage();
    const member = newUser(testInfo, "r3histmedlem");
    await joinClub(page, memberPage, member, clubId);
    const placeId = await insertPlace({
      clubId,
      name: "Hos Admin",
      address: "Bryggervej 7, 8381 Tilst",
      createdByEmail: admin.email,
      ownerEmails: [admin.email],
    });

    // A tasting three days ago, created through the form like any other.
    const eventId = await createEventViaForm(page, clubId, {
      title: "Forrige smagning",
      date: dayFromToday(-3),
      startTime: "18:30",
      endTime: "23:00",
      place: "Hos Admin",
    });
    await expect(page.getByText("Vært: " + admin.name)).toBeVisible();

    // The member adds the evening's beer from the event page and rates it.
    await memberPage.goto(`/c/${clubId}/events/${eventId}`);
    await memberPage
      .getByRole("region", { name: "Øl smagt til dette event" })
      .getByRole("link", { name: "Tilføj øl" })
      .click();
    await expect(memberPage.getByLabel("Event (valgfrit)")).toHaveValue(eventId);
    await fillBeerForm(memberPage, { name: "Westmalle Tripel", abv: "9,5" });
    await memberPage.getByRole("button", { name: "Tilføj øl", exact: true }).click();
    await expectNewBeerPage(memberPage, clubId, "Westmalle Tripel");
    await tapStars(memberPage, 4.5);
    await expectRatingSaved(memberPage);

    // Overblik: nothing upcoming, the history under the empty state (D-107).
    await mainNav(memberPage).getByRole("link", { name: "Overblik" }).click();
    await expect(
      memberPage.getByRole("heading", { name: "Ingen kommende ølsmagninger endnu 🍺" }),
    ).toBeVisible();
    const history = memberPage.getByRole("region", {
      name: "Tidligere ølsmagninger",
      exact: true,
    });
    const row = history.getByRole("link", { name: /Forrige smagning/ });
    await expect(row).toContainText("Hos Admin · 18:30–23:00");
    await expect(row).toContainText("1 øl · Bedst: Westmalle Tripel ★ 4,5");

    // "Se alle tidligere" → the calendar's list at #tidligere, under its month.
    await history.getByRole("link", { name: "Se alle tidligere" }).click();
    await expect(memberPage).toHaveURL(new RegExp(`/c/${clubId}/calendar\\?view=list#tidligere$`));
    const calendarRow = history.getByRole("link", { name: /Forrige smagning/ });
    await expect(calendarRow).toContainText("1 øl · Bedst: Westmalle Tripel ★ 4,5");
    await expect(history.getByRole("heading", { level: 3 }).first()).toBeVisible();

    // The admin (an owner) archives the used place: it is kept, not deleted (D-100).
    await page.goto(placePath(clubId, placeId));
    const archive = page.getByRole("button", { name: "Arkivér sted" });
    await expectHydrated(archive);
    await archive.click();
    const dialog = page.getByRole("alertdialog", { name: "Arkivér «Hos Admin»?" });
    await expect(dialog).toContainText("Stedet er brugt til 1 ølsmagning");
    await dialog.getByRole("button", { name: "Arkivér sted" }).click();
    await expect(
      page.getByText("Stedet er arkiveret. De gamle events viser det stadig."),
    ).toBeVisible();

    // The past tasting still shows its place (E4), and so does the history…
    await memberPage.goto(`/c/${clubId}/events/${eventId}`);
    await expect(memberPage.getByRole("link", { name: "Hos Admin", exact: true })).toBeVisible();
    await expect(memberPage.getByText("Arkiveret", { exact: true })).toBeVisible();
    await expect(memberPage.getByRole("link", { name: /Åbn i kort/ })).toHaveAttribute(
      "href",
      mapsUrl("Bryggervej 7, 8381 Tilst"),
    );
    await memberPage.goto(`/c/${clubId}`);
    await expect(row).toContainText("Hos Admin");
    // …but a new event cannot pick it any more.
    await memberPage.goto(`/c/${clubId}/events/new`);
    await expect(placeRadio(memberPage, "＋ Nyt sted")).toBeVisible();
    await expect(memberPage.getByRole("radio", { name: /Hos Admin/ })).toHaveCount(0);
  });

  test("(c) admin gør et medlem til admin; den sidste admin kan ikke gå; et medlem går og mister ejerskab og kommende værtskaber; klubben slettes", async ({
    page,
    openPage,
  }, testInfo) => {
    test.slow();
    const admin = newUser(testInfo, "r3styrer");
    const name = clubName(testInfo, "Bestyrelse");
    const clubId = await signUpWithClub(page, admin, name);
    const memberPage = await openPage();
    const member = newUser(testInfo, "r3afgaaende");
    await joinClub(page, memberPage, member, clubId);

    // Setup: the member owns a place and hosts a past and an upcoming tasting there.
    const placeId = await insertPlace({
      clubId,
      name: "Hos Medlemmet",
      createdByEmail: member.email,
      ownerEmails: [member.email],
    });
    const pastId = await insertEvent({
      clubId,
      createdByEmail: admin.email,
      title: "Afholdt hos medlemmet",
      startsAt: at(dayFromToday(-10), "19:00"),
      endsAt: at(dayFromToday(-10), "23:00"),
      placeName: "Hos Medlemmet",
      hostEmails: [member.email],
    });
    const upcomingId = await insertEvent({
      clubId,
      createdByEmail: admin.email,
      title: "Kommende hos medlemmet",
      startsAt: at(dayFromToday(10), "19:00"),
      placeName: "Hos Medlemmet",
      hostEmails: [member.email],
    });

    // The only admin cannot leave (E2): the reason and the shortcut instead.
    await page.goto(`/c/${clubId}/club`);
    const zone = dangerZone(page);
    await expect(zone).toContainText("Du er klubbens eneste admin.");
    await expect(zone.getByRole("button", { name: "Forlad klubben" })).toHaveCount(0);
    await expect(zone.getByRole("link", { name: "Gør et medlem til admin" })).toBeVisible();

    // The admin promotes the member (D-102); now the admin could leave too.
    await confirmMemberAction(page, member.name, "Gør til admin", `Gør ${member.name} til admin?`);
    await expect(page.getByText(`${member.name} er nu admin`)).toBeVisible();
    await expect(memberRow(page, member.name).getByText("Admin", { exact: true })).toBeVisible();
    await expect(zone.getByRole("button", { name: "Forlad klubben" })).toBeVisible();

    // The member leaves the club: home with a toast (D-104).
    await memberPage.goto(`/c/${clubId}/club`);
    const leave = dangerZone(memberPage).getByRole("button", { name: "Forlad klubben" });
    await expectHydrated(leave);
    await leave.click();
    const leaveDialog = memberPage.getByRole("alertdialog");
    await leaveDialog.getByRole("button", { name: "Forlad klubben" }).click();
    await expect(memberPage).toHaveURL(/\/onboarding$/);
    await expect(memberPage.getByText("Du har forladt klubben.")).toBeVisible();
    expect((await memberPage.goto(`/c/${clubId}`))?.status()).toBe(404);

    // §7.4: the ownership is gone and so is the upcoming hostship; the past one is history.
    await page.goto(placePath(clubId, placeId));
    await expect(ownersRegion(page)).toContainText("Ingen ejere.");
    await page.goto(`/c/${clubId}/events/${upcomingId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Kommende hos medlemmet" }),
    ).toBeVisible();
    await expect(page.getByText(/^Værter?:/)).toHaveCount(0);
    await page.goto(`/c/${clubId}/events/${pastId}`);
    await expect(page.getByText(`Vært: ${member.name}`)).toBeVisible();

    // Alone again: the only member, so leaving is not offered, deleting is (E3).
    await page.goto(`/c/${clubId}/club`);
    await expect(memberRows(page)).toHaveCount(1);
    await expect(zone).toContainText("Du er det eneste medlem.");

    // Delete the club by typing its name (D-103) → home with a toast.
    const open = zone.getByRole("button", { name: "Slet klubben" });
    await expectHydrated(open);
    await open.click();
    const deleteDialog = page.getByRole("alertdialog", { name: `Slet ${name}?` });
    await expect(deleteDialog).toContainText("2 events og 1 sted");
    const confirm = deleteDialog.getByRole("button", { name: "Slet klubben" });
    await expect(confirm).toBeDisabled();
    await deleteDialog.getByLabel("Skriv klubbens navn for at bekræfte").fill(name);
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText("Klubben er slettet.")).toBeVisible();
    const response = await page.goto(`/c/${clubId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: CLUB_404 })).toBeVisible();
  });
});
