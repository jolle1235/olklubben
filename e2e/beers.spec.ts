import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { countRatings, insertBeer, insertEvent, insertRating, sql } from "./support/db";
import { clubName, createClub, expectHydrated, newUser, signUpWithClub } from "./support/app";
import {
  at,
  clubRating,
  dayFromToday,
  expectNewBeerPage,
  expectRatingSaved,
  fillBeerForm,
  joinClub,
  ratingGroup,
  tapStars,
} from "./support/round2";

/**
 * Ølkatalog and ratings (SPEC §9.5, §10.5, §15.3 "Rate øl", E14, E21, D-063):
 * rating with keyboard and taps, the catalogue's search, sort and filter in
 * the URL, the duplicate warning, and who may edit or delete a beer.
 */

const FORBIDDEN_EDIT = "Kun den, der tilføjede øllen, og klubbens admins kan rette den.";

/** The beer cards in the catalogue, in the order shown. */
function catalogCards(page: Page) {
  return page.getByRole("main").getByRole("listitem");
}

async function beerRow(id: string) {
  const [row] = await sql<{ name: string; abv: string }>(
    "SELECT name, abv::text AS abv FROM beers WHERE id = $1",
    [id],
  );
  return row ?? null;
}

async function myRating(beerId: string, email: string): Promise<number | null> {
  const [row] = await sql<{ value: number }>(
    `SELECT value FROM beer_ratings
     WHERE beer_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)`,
    [beerId, email.toLowerCase()],
  );
  return row?.value ?? null;
}

test.describe("Ratings", () => {
  test("halv stjerne med piletaster og med tryk, ændr, fjern, og min rating på kortet", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "rater");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Rating"));
    const beerId = await insertBeer({
      clubId,
      createdByEmail: owner.email,
      name: "Westmalle Tripel",
      abv: 9.5,
    });

    await page.goto(`/c/${clubId}/beers`);
    const card = page.getByRole("link", { name: /Westmalle Tripel/ });
    await expect(card).toContainText("Din:");
    await expect(card).toHaveAccessibleName(/du har ikke ratet den endnu/);
    await card.click();
    await expect(page.getByRole("heading", { level: 1, name: "Westmalle Tripel" })).toBeVisible();

    // Keyboard (§15.2): a radio group of nine values; End = 5, ← = −½. Saved after a pause.
    const group = ratingGroup(page);
    await expect(group.getByRole("radio")).toHaveCount(9);
    await expectHydrated(group);
    await group.getByRole("radio", { name: "1 ud af 5" }).focus();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await expect(group.getByRole("radio", { name: "4,5 ud af 5" })).toBeFocused();
    await expectRatingSaved(page);
    await expect(group.getByRole("radio", { name: "4,5 ud af 5" })).toBeChecked();
    await expect.poll(() => myRating(beerId, owner.email)).toBe(9);
    await expect(clubRating(page)).toContainText("4,5");
    await expect(clubRating(page)).toContainText("1 rating");

    // Change it with a tap on the LEFT half of the third star: 2,5.
    await tapStars(page, 2.5);
    await expect(group.getByRole("radio", { name: "2,5 ud af 5" })).toBeChecked();
    await expect.poll(() => myRating(beerId, owner.email)).toBe(5);
    await expect(clubRating(page)).toContainText("2,5");

    // A refresh keeps it, and the catalogue card shows "Din: ★ 2,5".
    await page.reload();
    await expect(group.getByRole("radio", { name: "2,5 ud af 5" })).toBeChecked();
    await page.goto(`/c/${clubId}/beers`);
    await expect(card).toHaveAccessibleName(/din rating 2,5 ud af 5/);
    await expect(card).toContainText("2,5");

    // "Fjern min rating" (§9.5): gone from the database and the club's average.
    await card.click();
    await expectHydrated(page.getByRole("button", { name: "Fjern min rating" }));
    await page.getByRole("button", { name: "Fjern min rating" }).click();
    await expect(page.getByText("Rating fjernet")).toBeVisible();
    await expect.poll(() => countRatings(beerId)).toBe(0);
    await expect(clubRating(page)).toContainText("Ingen ratings endnu");
    await expect(group.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fjern min rating" })).toHaveCount(0);
  });

  test("hver gemning annonceres som et nyt “Gemt ✓”, også to lige efter hinanden", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "live");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Live"));
    const beerId = await insertBeer({
      clubId,
      createdByEmail: owner.email,
      name: "Orval",
      abv: 6.2,
    });
    await page.goto(`/c/${clubId}/beers/${beerId}`);

    // Record every text the aria-live region gets (what a screen reader hears).
    const status = page.getByRole("region", { name: "Din rating" }).locator('[aria-live="polite"]');
    await status.evaluate((element) => {
      const texts: string[] = [];
      (window as unknown as { liveTexts: string[] }).liveTexts = texts;
      new MutationObserver(() => {
        const text = element.textContent ?? "";
        if (texts.at(-1) !== text) texts.push(text);
      }).observe(element, { childList: true, characterData: true, subtree: true });
    });
    const liveTexts = () =>
      page.evaluate(() => (window as unknown as { liveTexts: string[] }).liveTexts);

    await tapStars(page, 4);
    await expectRatingSaved(page);
    // A second save while "Gemt ✓" is still shown (before it fades after 2.5 s):
    // the region is emptied first, so the same text is announced again.
    await tapStars(page, 3.5);
    await expect(ratingGroup(page).getByRole("radio", { name: "3,5 ud af 5" })).toBeChecked();
    await expect.poll(() => myRating(beerId, owner.email)).toBe(7);
    await expect
      .poll(async () => (await liveTexts()).slice(0, 3))
      .toEqual(["Gemt ✓", "", "Gemt ✓"]);
  });
});

test.describe("Ølkatalog", () => {
  test("søgning med æ/ø/å, sortering, eventfilter, og alt overlever en reload", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "katalog");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Katalog"));
    const eventId = await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Nordisk aften",
      startsAt: at(dayFromToday(-7), "18:30"),
    });
    const beers: { name: string; abv: number; event?: string; rating?: number }[] = [
      { name: "Abbey Ale", abv: 6, rating: 6 },
      { name: "Zombie Dust", abv: 6.2, rating: 8 },
      { name: "Æblecider Brut", abv: 4.5 },
      { name: "Ørbæk Fynsk Forår", abv: 5, event: eventId, rating: 10 },
      { name: "Åbenrå Pilsner", abv: 4.6, event: eventId },
    ];
    for (const beer of beers) {
      const id = await insertBeer({
        clubId,
        createdByEmail: owner.email,
        name: beer.name,
        abv: beer.abv,
        eventId: beer.event ?? null,
      });
      if (beer.rating) await insertRating({ beerId: id, email: owner.email, value: beer.rating });
    }
    // Another club of the same member: its event never shows up in this catalogue (§4.4).
    const otherClubId = await createClub(page, clubName(testInfo, "Andenklub"));
    const otherEventId = await insertEvent({
      clubId: otherClubId,
      createdByEmail: owner.email,
      title: "Hemmelig aften",
      startsAt: at(dayFromToday(-3), "18:30"),
    });
    await insertBeer({
      clubId: otherClubId,
      createdByEmail: owner.email,
      name: "Hemmelig Bajer",
      eventId: otherEventId,
    });

    await page.goto(`/c/${clubId}/beers`);
    await expect(page.getByRole("heading", { level: 1, name: "Ølkatalog" })).toBeVisible();
    await expect(page.getByText("5 øl", { exact: true })).toBeVisible();
    await expect(page.getByText("Hemmelig")).toHaveCount(0);

    // Default sort: best rating, unrated last (§9.5).
    await expect(page.getByLabel("Sorter")).toHaveValue("rating");
    // The selects apply themselves once hydrated (before that: the "Vis" button).
    await expectHydrated(page.getByLabel("Sorter"));
    await expect(catalogCards(page)).toHaveText([
      /Ørbæk Fynsk Forår/,
      /Zombie Dust/,
      /Abbey Ale/,
      /Æblecider Brut/,
      /Åbenrå Pilsner/,
    ]);

    // Name A–Å: Æ, Ø and Å come after Z.
    await page.getByLabel("Sorter").selectOption("name");
    await expect(page).toHaveURL(/sort=name/);
    await expect(catalogCards(page)).toHaveText([
      /Abbey Ale/,
      /Zombie Dust/,
      /Æblecider Brut/,
      /Ørbæk Fynsk Forår/,
      /Åbenrå Pilsner/,
    ]);

    // Search: case-insensitive, with æ/ø/å.
    const search = page.getByRole("searchbox", { name: "Søg øl" });
    await search.fill("ØRBÆK");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("ØRBÆK");
    await expect(catalogCards(page)).toHaveText([/Ørbæk Fynsk Forår/]);
    await expect(page.getByText("Viser 1 af 5 øl")).toBeVisible();
    await search.fill("å");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("å");
    await expect(catalogCards(page)).toHaveText([/Ørbæk Fynsk Forår/, /Åbenrå Pilsner/]);
    await search.fill("æble");
    await expect(catalogCards(page)).toHaveText([/Æblecider Brut/]);
    await search.fill("");
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);

    // Event filter: only the club's own events (with beers) are offered.
    const eventSelect = page.getByLabel("Event", { exact: true });
    await expect(eventSelect.getByRole("option", { name: /Nordisk aften/ })).toHaveCount(1);
    await expect(eventSelect.getByRole("option", { name: /Hemmelig/ })).toHaveCount(0);
    await eventSelect.selectOption(eventId);
    await expect(page).toHaveURL(new RegExp(`event=${eventId}`));
    await expect(catalogCards(page)).toHaveText([/Ørbæk Fynsk Forår/, /Åbenrå Pilsner/]);
    // While one event is shown, "Tilføj øl" adds to that event.
    await expect(
      page.getByRole("link", { name: "Tilføj øl", exact: true }).filter({ visible: true }),
    ).toHaveAttribute("href", `/c/${clubId}/beers/new?eventId=${eventId}`);

    // The URL keeps every choice: a reload shows the same.
    await page.reload();
    await expect(page.getByLabel("Sorter")).toHaveValue("name");
    await expect(eventSelect).toHaveValue(eventId);
    await expectHydrated(eventSelect);
    await expect(catalogCards(page)).toHaveText([/Ørbæk Fynsk Forår/, /Åbenrå Pilsner/]);

    // "Uden event", then a search without matches offers to add it.
    await eventSelect.selectOption("none");
    await expect(catalogCards(page)).toHaveText([/Abbey Ale/, /Zombie Dust/, /Æblecider Brut/]);
    await search.fill("Duvel");
    await expect(page.getByRole("heading", { name: /Ingen øl matcher/ })).toBeVisible();
    await page.getByRole("link", { name: "Nulstil filtre" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/beers\\?sort=name$`));
    await expect(catalogCards(page)).toHaveCount(5);

    // Another club's event is not offered in the beer form either.
    await page.goto(`/c/${clubId}/beers/new?eventId=${otherEventId}`);
    const formEvent = page.getByLabel("Event (valgfrit)");
    await expect(formEvent).toHaveValue("");
    await expect(formEvent.getByRole("option", { name: /Hemmelig/ })).toHaveCount(0);
  });

  test("dublet-advarsel (E21): samme navn i andre bogstaver, og Tilføj alligevel", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "dublet");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Dublet"));
    const existingId = await insertBeer({
      clubId,
      createdByEmail: owner.email,
      name: "Grimbergen Dubbel",
      abv: 6.5,
    });

    await page.goto(`/c/${clubId}/beers/new`);
    await fillBeerForm(page, { name: "grimbergen   DUBBEL", abv: "6,5" });
    await expect(page.getByText("Den her har I vist smagt før 👀")).toBeVisible();
    await expect(page.getByRole("link", { name: "Grimbergen Dubbel" })).toHaveAttribute(
      "href",
      `/c/${clubId}/beers/${existingId}`,
    );
    await expect(page.getByRole("button", { name: "Tilføj øl", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Tilføj alligevel" }).click();
    await expectNewBeerPage(page, clubId, "grimbergen DUBBEL");
    const [row] = await sql<{ count: number }>(
      "SELECT count(*)::int AS count FROM beers WHERE club_id = $1 AND lower(name) = 'grimbergen dubbel'",
      [clubId],
    );
    expect(row?.count).toBe(2);
  });
});

test.describe("Rettigheder for øl", () => {
  test("et medlem kan ikke rette eller slette andres øl, opretteren og admin kan, og sletning viser antal ratings (E14)", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "oladmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "OlRet"));
    const memberPage = await openPage();
    const member = newUser(testInfo, "olmedlem");
    await joinClub(page, memberPage, member, clubId);

    const adminBeerId = await insertBeer({
      clubId,
      createdByEmail: admin.email,
      name: "Adminens Bock",
      abv: 7.2,
    });
    await insertRating({ beerId: adminBeerId, email: admin.email, value: 8 });
    await insertRating({ beerId: adminBeerId, email: member.email, value: 5 });
    const memberBeerId = await insertBeer({
      clubId,
      createdByEmail: member.email,
      name: "Medlemmets Pils",
      abv: 4.6,
    });

    // The member sees no Rediger/Slet on the admin's beer, and its edit page is a real 404.
    await memberPage.goto(`/c/${clubId}/beers/${adminBeerId}`);
    await expect(
      memberPage.getByRole("heading", { level: 1, name: "Adminens Bock" }),
    ).toBeVisible();
    await expect(memberPage.getByRole("link", { name: "Rediger", exact: true })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: "Slet øl" })).toHaveCount(0);
    const edit = await memberPage.goto(`/c/${clubId}/beers/${adminBeerId}/edit`);
    expect(edit?.status()).toBe(404);

    // Forged request: the member's own edit form, pointed at the admin's beer.
    await memberPage.goto(`/c/${clubId}/beers/${memberBeerId}/edit`);
    await expect(memberPage.getByLabel("Navn")).toHaveValue("Medlemmets Pils");
    await memberPage.getByLabel("Navn").fill("Overtaget");
    // Set right before the submit: a re-render would put the real id back.
    await memberPage.evaluate((id) => {
      const input = document.querySelector<HTMLInputElement>('input[name="beerId"]');
      if (input) input.value = id;
    }, adminBeerId);
    await memberPage.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(memberPage.getByText(FORBIDDEN_EDIT)).toBeVisible();
    expect((await beerRow(adminBeerId))?.name).toBe("Adminens Bock");
    expect((await beerRow(memberBeerId))?.name).toBe("Medlemmets Pils");

    // The creator may edit their own beer.
    await memberPage.goto(`/c/${clubId}/beers/${memberBeerId}`);
    await memberPage.getByRole("link", { name: "Rediger", exact: true }).click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Rediger øl" })).toBeVisible();
    await memberPage.getByLabel("Alkoholprocent").fill("4,8");
    await memberPage.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(memberPage).toHaveURL(new RegExp(`/beers/${memberBeerId}$`));
    await expect(memberPage.getByText("Gemt ✓")).toBeVisible();
    expect((await beerRow(memberBeerId))?.abv).toBe("4.8");

    // The admin may edit and delete the member's beer.
    await page.goto(`/c/${clubId}/beers/${memberBeerId}`);
    await expect(page.getByRole("link", { name: "Rediger", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Slet øl" })).toBeVisible();

    // E14: deleting a beer says how many ratings go with it, and removes them.
    await page.goto(`/c/${clubId}/beers/${adminBeerId}`);
    await expectHydrated(page.getByRole("button", { name: "Slet øl" }));
    await page.getByRole("button", { name: "Slet øl" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Øllen og dens 2 ratings bliver slettet.");
    await dialog.getByRole("button", { name: "Slet øl" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/beers$`));
    await expect(page.getByText("Øllen er slettet.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Adminens Bock/ })).toHaveCount(0);
    expect(await beerRow(adminBeerId)).toBeNull();
    expect(await countRatings(adminBeerId)).toBe(0);
  });
});
