import type { Page } from "@playwright/test";

import { capitalize, dateKeyLabel } from "../src/components/features/calendar/event-format";
import { formatDayMonthParts } from "../src/lib/format/date";
import { monthKeyLabel, nextMonthKey } from "../src/server/domain/calendar/month";
import { utcToZonedParts } from "../src/server/domain/events/time";
import { expect, test } from "./fixtures";
import { insertEvent, sql } from "./support/db";
import {
  clubName,
  createClub,
  expectHydrated,
  expectOverview,
  mainNav,
  newUser,
  signUpWithClub,
} from "./support/app";
import {
  at,
  createEventViaForm,
  dayFromToday,
  HOUR,
  isMobile,
  longDate,
  nextDstEndDay,
  today,
} from "./support/round2";

/**
 * Round 2: Overblik (SPEC §9.1) and Kalender (§9.3, D-078; round 3's history
 * section D-107 is covered in depth by history.spec.ts). Events are
 * inserted with SQL where the form is not the point (it is tested in
 * events.spec.ts); dates are Copenhagen calendar days relative to today, so
 * the tests run on any day.
 */

/** The hero card on Overblik (a region named by its "Næste ølsmagning" label). */
function hero(page: Page) {
  return page.getByRole("region", { name: "Næste ølsmagning" });
}

/** The mobile top bar (< md), where the page's + action sits. */
function topBar(page: Page) {
  return page.getByRole("banner");
}

test.describe("Overblik", () => {
  test("viser næste event stort, kommende arrangementer og tom tilstand", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "overblik");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Overblik"));

    // No events yet (§9.1 empty state); the invitation lives on the club page (D-163).
    await expect(
      page.getByRole("heading", { name: "Ingen kommende ølsmagninger endnu 🍺" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inviter dine ølbrødre" })).toHaveCount(0);
    await expect(hero(page)).toHaveCount(0);

    const heroDay = dayFromToday(3);
    const heroId = await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Ølsmagning #14",
      startsAt: at(heroDay, "18:30"),
      placeName: "Hos Mads",
    });
    await sql("UPDATE events SET theme = $1 WHERE id = $2", ["Belgiske øl", heroId]);
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Juleøl warmup",
      startsAt: at(dayFromToday(10), "19:00"),
      endsAt: at(dayFromToday(10), "23:00"),
      placeName: "Hos Anders",
    });
    // Another club's event (same user) never shows up here (§4.4).
    const otherClubId = await createClub(page, clubName(testInfo, "Hemmelig"));
    await insertEvent({
      clubId: otherClubId,
      createdByEmail: owner.email,
      title: "Hemmelig smagning",
      startsAt: at(dayFromToday(1), "18:00"),
    });

    await page.goto(`/c/${clubId}`);
    await expectOverview(page, clubId);
    await expect(hero(page)).toContainText("Ølsmagning #14");
    await expect(hero(page)).toContainText("om 3 dage");
    await expect(hero(page)).toContainText("18:30");
    await expect(hero(page)).toContainText("Hos Mads");
    await expect(hero(page)).toContainText("Tema: Belgiske øl");

    const upcoming = page.getByRole("region", { name: "Kommende arrangementer" });
    await expect(upcoming.getByRole("link", { name: /Juleøl warmup/ })).toBeVisible();
    await expect(upcoming).toContainText("Hos Anders · 19:00–23:00");
    await expect(page.getByText("Hemmelig smagning")).toHaveCount(0);
    // A touch target (SPEC §15.1): at least 44 px tall.
    const calendarLink = upcoming.getByRole("link", { name: "Se hele kalenderen" });
    expect((await calendarLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await hero(page).getByRole("link", { name: "Se event" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/events/${heroId}$`));
  });

  test("I morgen og I gang nu med genveje til Tilføj øl og Sangbog", async ({ page }, testInfo) => {
    const owner = newUser(testInfo, "igang");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "IGang"));

    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Smagning i morgen",
      startsAt: at(dayFromToday(1), "18:30"),
    });
    await page.reload();
    await expect(hero(page)).toContainText("Smagning i morgen");
    await expect(hero(page)).toContainText("I morgen!");
    await expect(hero(page).getByRole("link", { name: "Tilføj øl" })).toHaveCount(0);
    if (isMobile(testInfo)) {
      await expect(topBar(page).getByRole("link", { name: "Opret event" })).toBeVisible();
    }

    const now = Date.now();
    const ongoingId = await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Smagning lige nu",
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + 2 * HOUR),
    });
    await page.reload();
    await expect(hero(page)).toContainText("Smagning lige nu");
    await expect(hero(page)).toContainText("I gang nu");
    await expect(hero(page).getByRole("link", { name: "Tilføj øl" })).toHaveAttribute(
      "href",
      `/c/${clubId}/beers/new?eventId=${ongoingId}`,
    );
    await expect(hero(page).getByRole("link", { name: "Sangbog" })).toHaveAttribute(
      "href",
      `/c/${clubId}/songs`,
    );
    // The top bar's + follows the hero (like the event page, D-080).
    if (isMobile(testInfo)) {
      const plus = topBar(page).getByRole("link", { name: "Tilføj øl" });
      await expect(plus).toHaveAttribute("href", `/c/${clubId}/beers/new?eventId=${ongoingId}`);
      await expect(topBar(page).getByRole("link", { name: "Opret event" })).toHaveCount(0);
    }
    // Tomorrow's event moves to "Kommende arrangementer".
    await expect(
      page
        .getByRole("region", { name: "Kommende arrangementer" })
        .getByRole("link", { name: /Smagning i morgen/ }),
    ).toBeVisible();
  });
});

test.describe("Hero-tilstande og tid", () => {
  test("I aften! 🍻 for et event senere i dag, også på eventsiden og i kalenderen", async ({
    page,
  }, testInfo) => {
    // Later today in Copenhagen; too close to midnight there is no "later today".
    const startsAt = [2 * HOUR, HOUR / 2, HOUR / 6]
      .map((offset) => new Date(Date.now() + offset))
      .find((instant) => utcToZonedParts(instant).date === today());
    test.skip(!startsAt, "Kl. er for tæt på midnat til et event senere i dag.");
    if (!startsAt) return;

    const owner = newUser(testInfo, "iaften");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "IAften"));
    const eventId = await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Smagning i aften",
      startsAt,
    });
    await page.reload();
    await expect(hero(page)).toContainText("Smagning i aften");
    await expect(hero(page)).toContainText("I aften! 🍻");
    // Before the start: no "Tilføj øl"/"Sangbog" shortcuts yet (§9.1).
    await expect(hero(page).getByRole("link", { name: "Tilføj øl" })).toHaveCount(0);

    await page.goto(`/c/${clubId}/events/${eventId}`);
    await expect(page.getByText("I aften! 🍻")).toBeVisible();
    await page.goto(`/c/${clubId}/calendar?view=list`);
    await expect(page.getByRole("link", { name: /Smagning i aften/ })).toContainText("I aften! 🍻");
  });

  test("18:30 på dagen, hvor uret stilles tilbage, er 18:30 overalt, og natten over er tilladt (E20)", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "vintertid");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Vintertid"));
    const day = nextDstEndDay();
    const startsAt = at(day, "18:30");

    const eventId = await createEventViaForm(page, clubId, {
      title: "Vintertidssmagning",
      date: day,
      startTime: "18:30",
      endTime: "01:00",
      place: "Hos Uret",
    });
    // Winter time (UTC+1) from 03:00 that night: 18:30 is 17:30 UTC.
    expect(startsAt.toISOString()).toBe(`${day}T17:30:00.000Z`);
    const [row] = await sql<{ starts_at: Date; ends_at: Date }>(
      "SELECT starts_at, ends_at FROM events WHERE id = $1",
      [eventId],
    );
    expect(row?.starts_at.toISOString()).toBe(startsAt.toISOString());
    // 18:30–01:00 ends the next day: 6½ hours later.
    expect(row?.ends_at.getTime()).toBe(startsAt.getTime() + 6.5 * HOUR);

    // Event page.
    await expect(page.locator(`time[datetime="${startsAt.toISOString()}"]`)).toHaveText("18:30");
    await expect(page.getByText(new RegExp(longDate(day), "i"))).toBeVisible();

    // Overblik: the hero (the club's only event).
    await page.goto(`/c/${clubId}`);
    await expect(hero(page)).toContainText("Vintertidssmagning");
    await expect(hero(page)).toContainText("18:30–01:00");
    await expect(hero(page).locator("time").first()).toHaveAttribute("datetime", day);
    await expect(hero(page)).toContainText(formatDayMonthParts(startsAt)?.day ?? "?");

    // Kalender, month view: on its own date (not the next day), at 18:30.
    await page.goto(`/c/${clubId}/calendar?view=month&month=${day.slice(0, 7)}`);
    const cell = page.locator(`td[data-date="${day}"]`);
    if (isMobile(testInfo)) {
      await cell.getByRole("link", { name: `${longDate(day)}, 1 event` }).click();
      const panel = page.getByRole("region", { name: new RegExp(`^${longDate(day)}$`, "i") });
      await expect(panel.getByRole("link", { name: /Vintertidssmagning/ })).toContainText(
        "Hos Uret · 18:30–01:00",
      );
    } else {
      await expect(cell.getByRole("link", { name: /Vintertidssmagning/ })).toContainText("18:30");
    }
  });
});

test.describe("Kalender", () => {
  test("listevisning grupperer kommende events pr. måned, tidligere under 'Tidligere ølsmagninger', og kun klubbens egne", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "kalender");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Kalender"));

    await page.goto(`/c/${clubId}/calendar?view=list`);
    await expect(page.getByRole("heading", { level: 1, name: "Kalender" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ingen kommende ølsmagninger endnu 🍺" }),
    ).toBeVisible();

    const soon = dayFromToday(2);
    const later = dayFromToday(40);
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Snart-smagning",
      startsAt: at(soon, "18:30"),
      placeName: "Hos Jesper",
    });
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Senere-smagning",
      startsAt: at(later, "19:00"),
    });
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Gammel smagning",
      startsAt: at(dayFromToday(-20), "18:30"),
    });
    const otherClubId = await createClub(page, clubName(testInfo, "Hemmelig"));
    await insertEvent({
      clubId: otherClubId,
      createdByEmail: owner.email,
      title: "Hemmelig smagning",
      startsAt: at(soon, "20:00"),
    });

    await page.goto(`/c/${clubId}/calendar?view=list`);
    // Exact names: a past month is "Tidligere ølsmagninger <måned>" (D-107).
    const soonMonth = page.getByRole("region", {
      name: monthKeyLabel(soon.slice(0, 7)),
      exact: true,
    });
    await expect(soonMonth.getByRole("link", { name: /Snart-smagning/ })).toBeVisible();
    await expect(soonMonth).toContainText("Hos Jesper · 18:30");
    await expect(
      page
        .getByRole("region", { name: monthKeyLabel(later.slice(0, 7)), exact: true })
        .getByRole("link", { name: /Senere-smagning/ }),
    ).toBeVisible();
    // The past event sits in the history section only (D-107), never another
    // club's events (§4.4).
    const history = page.getByRole("region", { name: "Tidligere ølsmagninger", exact: true });
    await expect(history.getByRole("link", { name: /Gammel smagning/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Gammel smagning/ })).toHaveCount(1);
    await expect(soonMonth.getByText("Gammel smagning")).toHaveCount(0);
    await expect(page.getByText("Hemmelig smagning")).toHaveCount(0);

    // The view is in the URL: a refresh keeps it.
    await page.reload();
    await expect(page.getByRole("link", { name: "Liste", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(soonMonth.getByRole("link", { name: /Snart-smagning/ })).toBeVisible();

    // The month view shows the club's events of that month, never another club's.
    await page.goto(`/c/${clubId}/calendar?view=month&month=${soon.slice(0, 7)}`);
    await expect(page.locator(`td[data-date="${soon}"]`)).toBeVisible();
    if (!isMobile(testInfo)) {
      await expect(
        page.locator(`td[data-date="${soon}"]`).getByRole("link", { name: /Snart-smagning/ }),
      ).toBeVisible();
    }
    await expect(page.getByText("Hemmelig smagning")).toHaveCount(0);
  });

  test("månedsvisning: dag med to events, bladring og refresh", async ({ page }, testInfo) => {
    const owner = newUser(testInfo, "maaned");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Maaned"));

    const day = dayFromToday(10);
    const month = day.slice(0, 7);
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Frokostsmagning",
      startsAt: at(day, "14:00"),
    });
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Aftensmagning",
      startsAt: at(day, "19:00"),
    });

    await mainNav(page).getByRole("link", { name: "Kalender" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kalender" })).toBeVisible();
    await page.getByRole("link", { name: "Måned", exact: true }).click();
    await expect(page).toHaveURL(/view=month/);

    await page.goto(`/c/${clubId}/calendar?view=month&month=${month}`);
    await expect(page.getByRole("columnheader", { name: "mandag" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: monthKeyLabel(day.slice(0, 7)) }),
    ).toBeVisible();

    if (isMobile(testInfo)) {
      // Dots on the date; a tap shows the day's events under the grid.
      const label = `${dateKeyLabel(day, new Date())}, 2 events`;
      await page.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`day=${day}`));
      const panel = page.getByRole("region", {
        name: capitalize(dateKeyLabel(day, new Date())),
        exact: true,
      });
      await expect(panel.getByRole("link", { name: /Frokostsmagning/ })).toBeVisible();
      await expect(panel.getByRole("link", { name: /Aftensmagning/ })).toBeVisible();
      await expect(page.getByRole("link", { name: `${label}, valgt` })).toBeVisible();

      await page.reload();
      await expect(page.getByRole("link", { name: `${label}, valgt` })).toBeVisible();
      await expect(panel.getByRole("link", { name: /Aftensmagning/ })).toBeVisible();
    } else {
      // Readable chips with title and time (§13.4.1).
      const grid = page.getByRole("table");
      await expect(grid.getByRole("link", { name: /Frokostsmagning/ })).toContainText("14:00");
      await expect(grid.getByRole("link", { name: /Aftensmagning/ })).toContainText("19:00");
    }

    // Browse months (links, so the URL keeps the month).
    await page.getByRole("link", { name: "Næste måned" }).click();
    await expect(page).toHaveURL(new RegExp(`month=${nextMonthKey(month)}`));
    await page.getByRole("link", { name: "Forrige måned" }).click();
    await expect(page).toHaveURL(new RegExp(`month=${month}`));
    await expect(
      page.getByRole("heading", { level: 2, name: monthKeyLabel(day.slice(0, 7)) }),
    ).toBeVisible();

    // Today is marked once (in the visible variant of the grid).
    await page.getByRole("link", { name: "I dag", exact: true }).click();
    await expect(page.locator('[aria-current="date"]:visible')).toHaveCount(1);
  });

  test("tastaturfokus bliver på visningsskifteren og månedspilene", async ({ page }, testInfo) => {
    const owner = newUser(testInfo, "fokus");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Fokus"));
    const month = today().slice(0, 7);

    /** Activates the focused link with Enter and waits for the URL. */
    async function pressEnterOn(name: string, url: RegExp) {
      const link = page.getByRole("link", { name, exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(url);
    }

    /** The new view's toggle link has focus (not <body>). */
    async function expectToggleFocused(label: string) {
      const link = page.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(link).toBeFocused();
    }

    // From /calendar without ?view (list on mobile, month on desktop) to the other view.
    await page.goto(`/c/${clubId}/calendar`);
    const [first, second] = isMobile(testInfo) ? ["Måned", "Liste"] : ["Liste", "Måned"];
    await expectHydrated(page.getByRole("link", { name: first, exact: true }));
    await pressEnterOn(first, new RegExp(`view=${first === "Måned" ? "month" : "list"}`));
    await expectToggleFocused(first);

    // And back, between two explicit views.
    await pressEnterOn(second, new RegExp(`view=${second === "Måned" ? "month" : "list"}`));
    await expectToggleFocused(second);

    // The month arrows and [I dag] keep focus too.
    await page.goto(`/c/${clubId}/calendar?view=month`);
    await expectHydrated(page.getByRole("link", { name: "Næste måned" }));
    await pressEnterOn("Næste måned", new RegExp(`month=${nextMonthKey(month)}`));
    await expect(page.getByRole("link", { name: "Næste måned" })).toBeFocused();
    await pressEnterOn("I dag", /view=month$/);
    await expect(page.getByRole("link", { name: "I dag", exact: true })).toBeFocused();
  });
});
