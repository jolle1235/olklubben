import type { Page } from "@playwright/test";

import { monthKeyLabel } from "../src/server/domain/calendar/month";
import { expect, test } from "./fixtures";
import { insertBeer, insertEvent, insertRating } from "./support/db";
import { clubName, newUser, signUpWithClub } from "./support/app";
import { at, dayFromToday, HOUR, isMobile, longDate } from "./support/round2";

/**
 * Round 3, event history (SPEC §9.1, §9.3, D-107): "Tidligere ølsmagninger"
 * on Overblik (the 3 newest, beers and the best-rated one, "Se alle
 * tidligere") and in the calendar's list view (#tidligere: by month, newest
 * first, 12 and then "Vis alle N tidligere" = ?past=all). The month view is
 * unchanged. Events, beers and ratings are inserted with SQL.
 */

/** "Tidligere ølsmagninger" (exact: each past month is "Tidligere ølsmagninger <måned>"). */
function history(page: Page) {
  return page.getByRole("region", { name: "Tidligere ølsmagninger", exact: true });
}

/** A past tasting `weeksAgo` weeks ago, 18:30–22:30. */
async function insertPast(clubId: string, email: string, title: string, weeksAgo: number) {
  const day = dayFromToday(-7 * weeksAgo);
  return insertEvent({
    clubId,
    createdByEmail: email,
    title,
    startsAt: at(day, "18:30"),
    endsAt: at(day, "22:30"),
  });
}

test.describe("Eventhistorik", () => {
  test("Overblik viser de 3 nyeste med øl og bedste øl, og Kalender viser 12 pr. måned og så 'Vis alle'", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "historik");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Historik"));

    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Næste gang",
      startsAt: at(dayFromToday(3), "18:30"),
    });
    const ids: string[] = [];
    for (let week = 1; week <= 14; week += 1) {
      ids.push(
        await insertPast(clubId, owner.email, `Historik ${String(week).padStart(2, "0")}`, week),
      );
    }
    // Historik 01: two rated beers; 02: one unrated beer; 03: none.
    const best = await insertBeer({
      clubId,
      createdByEmail: owner.email,
      name: "Westmalle Tripel",
      eventId: ids[0],
    });
    const other = await insertBeer({
      clubId,
      createdByEmail: owner.email,
      name: "Pilsner",
      eventId: ids[0],
    });
    await insertRating({ beerId: best, email: owner.email, value: 9 });
    await insertRating({ beerId: other, email: owner.email, value: 6 });
    await insertBeer({ clubId, createdByEmail: owner.email, name: "Urørt", eventId: ids[1] });

    // Overblik: after the upcoming events, the 3 newest past tastings, newest first.
    await page.goto(`/c/${clubId}`);
    const rows = history(page).getByRole("link", { name: /^Historik/ });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Historik 01");
    await expect(rows.nth(0)).toContainText("2 øl · Bedst: Westmalle Tripel ★ 4,5");
    await expect(rows.nth(1)).toContainText("Historik 02");
    await expect(rows.nth(1)).toContainText("1 øl");
    await expect(rows.nth(2)).toContainText("Historik 03");
    await expect(rows.nth(2)).toContainText("Ingen øl registreret");
    await expect(rows.nth(0)).toHaveAccessibleName(
      new RegExp(longDate(dayFromToday(-7)).replace(/[.]/g, "\\.")),
    );
    await expect(page.getByRole("region", { name: "Næste ølsmagning" })).toContainText(
      "Næste gang",
    );

    // "Se alle tidligere" → the calendar's list, at #tidligere.
    await history(page).getByRole("link", { name: "Se alle tidligere" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/calendar\\?view=list#tidligere$`));
    await expect(history(page).getByRole("heading", { level: 2 })).toBeInViewport();
    const cards = history(page).getByRole("link", { name: /^Historik/ });
    await expect(cards).toHaveCount(12);
    await expect(cards.first()).toContainText("Historik 01");
    await expect(cards.last()).toContainText("Historik 12");
    await expect(page.getByRole("link", { name: /Historik 13/ })).toHaveCount(0);

    // Months newest first, each named apart from the upcoming months.
    const firstMonth = monthKeyLabel(dayFromToday(-7).slice(0, 7));
    const months = history(page).getByRole("heading", { level: 3 });
    await expect(months.first()).toHaveText(firstMonth);
    await expect(
      page.getByRole("region", { name: `Tidligere ølsmagninger ${firstMonth}`, exact: true }),
    ).toContainText("Historik 01");

    // "Vis alle 14 tidligere" → ?past=all.
    await history(page).getByRole("link", { name: "Vis alle 14 tidligere" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/c/${clubId}/calendar\\?view=list&past=all#tidligere$`),
    );
    await expect(cards).toHaveCount(14);
    await expect(history(page).getByRole("heading", { level: 2 })).toBeInViewport();
    await expect(cards.last()).toContainText("Historik 14");
    await expect(history(page).getByRole("link", { name: /^Vis alle/ })).toHaveCount(0);
  });

  test("uden kommende events: tom tilstand og historikken under den, uden henvisning til månedsvisningen", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "kunfortid");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Fortid"));
    const eventId = await insertPast(clubId, owner.email, "Sidste smagning", 2);
    await insertBeer({ clubId, createdByEmail: owner.email, name: "Gammel Carlsberg", eventId });

    await page.goto(`/c/${clubId}`);
    await expect(
      page.getByRole("heading", { name: "Ingen kommende ølsmagninger endnu 🍺" }),
    ).toBeVisible();
    await expect(history(page).getByRole("link", { name: /Sidste smagning/ })).toContainText(
      "1 øl",
    );

    await page.goto(`/c/${clubId}/calendar?view=list`);
    await expect(
      page.getByRole("heading", { name: "Ingen kommende ølsmagninger endnu 🍺" }),
    ).toBeVisible();
    await expect(history(page).getByRole("link", { name: /Sidste smagning/ })).toBeVisible();
    // D-062's hint is gone: the history is right here (D-107).
    await expect(page.getByText(/månedsvisningen/)).toHaveCount(0);
    await expect(history(page).getByRole("link", { name: /^Vis alle/ })).toHaveCount(0);
  });

  test("månedsvisningen er uændret: et tidligere event står på sin dato, uden historiksektion", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "maanedhist");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "MaanedHist"));
    const day = dayFromToday(-10);
    await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Tiendagssmagning",
      startsAt: at(day, "19:00"),
      endsAt: new Date(at(day, "19:00").getTime() + 3 * HOUR),
    });

    await page.goto(`/c/${clubId}/calendar?view=month&month=${day.slice(0, 7)}`);
    const cell = page.locator(`td[data-date="${day}"]`);
    if (isMobile(testInfo)) {
      await cell.getByRole("link", { name: `${longDate(day)}, 1 event` }).click();
      await expect(page.getByRole("link", { name: /Tiendagssmagning/ })).toBeVisible();
    } else {
      await expect(cell.getByRole("link", { name: /Tiendagssmagning/ })).toContainText("19:00");
    }
    await expect(history(page)).toHaveCount(0);
  });
});
