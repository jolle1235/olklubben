import { expect, test } from "./fixtures";
import { clubName, mainNav, newUser, signUpWithClub } from "./support/app";
import {
  clubRating,
  createEventViaForm,
  dayFromToday,
  expectNewBeerPage,
  expectRatingSaved,
  fillBeerForm,
  isMobile,
  joinClub,
  longDate,
  ratingGroup,
  tapStars,
} from "./support/round2";

/**
 * Round 2's Definition of Done (SPEC §16.3):
 *   (a) create an event → see it on Overblik → see it in Kalender
 *   (b) add a beer → link it to an event → rate it → see the club's average
 * Both as an ordinary member (not the admin), through the real UI.
 */

test.describe("Runde 2: Definition of Done", () => {
  test("(a) et medlem opretter et event, ser det som hero på Overblik og i Kalender (liste og måned)", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "dodadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "DoD"));
    const memberPage = await openPage();
    const member = newUser(testInfo, "dodmedlem");
    await joinClub(page, memberPage, member, clubId);

    const date = dayFromToday(5);
    const eventId = await createEventViaForm(memberPage, clubId, {
      title: "Ølsmagning #1",
      date,
      startTime: "19:00",
      endTime: "23:30",
      locationText: "Hos Medlemmet",
      theme: "Tjekkiske øl",
    });
    await expect(memberPage.getByText("Skål! Eventet er oprettet 🍻")).toBeVisible();
    // The toast flag is removed from the address bar again.
    await expect(memberPage).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(
      memberPage.getByRole("heading", { level: 1, name: "Ølsmagning #1" }),
    ).toBeVisible();
    await expect(memberPage.getByText("Oprettet af")).toContainText(member.name);
    // The creator may edit their own event (D-061).
    await expect(memberPage.getByRole("link", { name: "Rediger", exact: true })).toBeVisible();

    // Overblik: the next event is the hero.
    await mainNav(memberPage).getByRole("link", { name: "Overblik" }).click();
    const hero = memberPage.getByRole("region", { name: "Næste ølsmagning" });
    await expect(hero.getByRole("heading", { level: 2, name: "Ølsmagning #1" })).toBeVisible();
    await expect(hero).toContainText("om 5 dage");
    await expect(hero).toContainText("19:00–23:30");
    await expect(hero).toContainText("Hos Medlemmet");
    await expect(hero).toContainText("Tema: Tjekkiske øl");

    // Kalender, list view: grouped under the event's month.
    await mainNav(memberPage).getByRole("link", { name: "Kalender" }).click();
    await memberPage.getByRole("link", { name: "Liste", exact: true }).click();
    await expect(memberPage).toHaveURL(/view=list/);
    const card = memberPage.getByRole("link", { name: /Ølsmagning #1/ });
    await expect(card).toContainText("Hos Medlemmet · 19:00–23:30");
    await expect(card).toHaveAccessibleName(new RegExp(longDate(date)));

    // Month view: on the right date (browse to its month if needed).
    await memberPage.getByRole("link", { name: "Måned", exact: true }).click();
    await expect(memberPage).toHaveURL(/view=month/);
    if (date.slice(0, 7) !== dayFromToday(0).slice(0, 7)) {
      await memberPage.getByRole("link", { name: "Næste måned" }).click();
      await expect(memberPage).toHaveURL(new RegExp(`month=${date.slice(0, 7)}`));
    }
    const cell = memberPage.locator(`td[data-date="${date}"]`);
    if (isMobile(testInfo)) {
      // A dot on the date; a tap shows the day's events under the grid.
      await cell.getByRole("link", { name: `${longDate(date)}, 1 event` }).click();
      const panel = memberPage.getByRole("region", {
        name: new RegExp(`^${longDate(date)}$`, "i"),
      });
      await expect(panel.getByRole("link", { name: /Ølsmagning #1/ })).toBeVisible();
    } else {
      await expect(cell.getByRole("link", { name: /Ølsmagning #1/ })).toContainText("19:00");
    }

    // The admin sees it too (another member's view of the same club).
    await page.goto(`/c/${clubId}`);
    await expect(
      page.getByRole("region", { name: "Næste ølsmagning" }).getByText("Ølsmagning #1"),
    ).toBeVisible();
  });

  test("(b) et medlem tilføjer en øl til et event og rater den, en anden rater, og gennemsnittet opdateres", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "olddadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "OlDoD"));
    const memberPage = await openPage();
    const member = newUser(testInfo, "oldmedlem");
    await joinClub(page, memberPage, member, clubId);

    const eventId = await createEventViaForm(page, clubId, {
      title: "Belgisk aften",
      date: dayFromToday(-1),
      startTime: "18:30",
      locationText: "Hos Admin",
    });

    // The member adds a beer from the event page: the event is pre-filled (§9.2).
    await memberPage.goto(`/c/${clubId}/events/${eventId}`);
    await memberPage
      .getByRole("region", { name: "Øl smagt til dette event" })
      .getByRole("link", { name: "Tilføj øl" })
      .click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Tilføj øl" })).toBeVisible();
    await expect(memberPage.getByLabel("Event (valgfrit)")).toHaveValue(eventId);
    await fillBeerForm(memberPage, { name: "Westmalle Dubbel", abv: "7.0" });
    await memberPage.getByRole("button", { name: "Tilføj øl", exact: true }).click();
    await expectNewBeerPage(memberPage, clubId, "Westmalle Dubbel");
    await expect(memberPage.getByText("Skål! Øllen er tilføjet 🍺")).toBeVisible();
    await expect(memberPage.getByText("7,0 %")).toBeVisible();
    // "Smagt til" links back to the event.
    await expect(
      memberPage
        .getByRole("region", { name: "Smagt til" })
        .getByRole("link", { name: /Belgisk aften/ }),
    ).toHaveAttribute("href", `/c/${clubId}/events/${eventId}`);
    const beerUrl = memberPage.url();

    // Rate: the left half of the fifth star = 4,5 (saved at once, §9.5).
    await expect(clubRating(memberPage)).toContainText("Ingen ratings endnu");
    await tapStars(memberPage, 4.5);
    await expectRatingSaved(memberPage);
    await expect(ratingGroup(memberPage).getByRole("radio", { name: "4,5 ud af 5" })).toBeChecked();
    await expect(clubRating(memberPage)).toContainText("4,5");
    await expect(clubRating(memberPage)).toContainText("1 rating");

    // A second member (the admin) rates 3,5 → the club's average is 4,0 from 2 ratings.
    await page.goto(beerUrl);
    await expect(clubRating(page)).toContainText("4,5");
    await tapStars(page, 3.5);
    await expectRatingSaved(page);
    await expect(clubRating(page)).toContainText("4,0");
    await expect(clubRating(page)).toContainText("2 ratings");
    const ratings = page.getByRole("region", { name: /^Ratings/ });
    await expect(ratings.getByRole("listitem")).toHaveCount(2);
    await expect(ratings.getByRole("listitem").filter({ hasText: member.name })).toContainText(
      "4,5",
    );

    // The first member sees the new average after a refresh.
    await memberPage.reload();
    await expect(clubRating(memberPage)).toContainText("4,0");
    await expect(clubRating(memberPage)).toContainText("2 ratings");

    // …and the beer is on the event's list with the club's rating and their own.
    await memberPage.goto(`/c/${clubId}/events/${eventId}`);
    const beerLink = memberPage
      .getByRole("region", { name: "Øl smagt til dette event" })
      .getByRole("link", { name: /Westmalle Dubbel/ });
    await expect(beerLink).toHaveAccessibleName(/klubbens rating 4,0 ud af 5 \(2 ratings\)/);
    await expect(beerLink).toHaveAccessibleName(/din rating 4,5 ud af 5/);
    await beerLink.click();
    await expect(memberPage).toHaveURL(beerUrl);
  });
});
