import sharp from "sharp";

import { expect, test } from "./fixtures";
import { clubName, newUser, signUpWithClub } from "./support/app";
import { insertBeer, insertEvent, sql } from "./support/db";
import { at, dayFromToday, expectNewBeerPage, fillBeerForm } from "./support/round2";

/**
 * A beer's photo (SPEC §9.5, D-158): added from the event's "+ Tilføj øl"
 * (the event pre-selected), kept through the duplicate warning's "Tilføj
 * alligevel", shown on the beer page and its card, replaced and removed when
 * editing, and served only to members of the club.
 */

async function photo(width: number, height: number) {
  return {
    name: "oel.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 140, b: 30 } },
    })
      .png()
      .toBuffer(),
  };
}

async function storedImage(beerId: string) {
  const [row] = await sql<{ content_type: string; width: number; height: number }>(
    "SELECT content_type, width, height FROM beer_images WHERE beer_id = $1",
    [beerId],
  );
  return row ?? null;
}

test("et billede tilføjes fra eventet, overlever dublet-advarslen og vises kun for klubben", async ({
  page,
  openPage,
}, testInfo) => {
  const admin = newUser(testInfo, "fotograf");
  const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Fotoklub"));
  const eventId = await insertEvent({
    clubId,
    createdByEmail: admin.email,
    title: "Ølsmagning med billeder",
    startsAt: at(dayFromToday(0), "19:00"),
  });

  // From the event: "+ Tilføj øl" has the event pre-selected.
  await page.goto(`/c/${clubId}/events/${eventId}`);
  await page
    .getByRole("link", { name: /Tilføj øl/ })
    .first()
    .click();
  await expect(page.getByLabel("Event (valgfrit)")).toHaveValue(eventId);
  // A duplicate only the server knows (the form loaded before it existed, F-053).
  await insertBeer({ clubId, createdByEmail: admin.email, name: "Fotobajer" });
  await fillBeerForm(page, { name: "Fotobajer", abv: "5,2" });
  await page.getByLabel("Billede (valgfrit)").setInputFiles(await photo(2400, 1600));
  await expect(page.getByRole("img", { name: "Billede af øllen" })).toBeVisible();

  // The server's duplicate warning resets the form; the photo must still be sent.
  await page.getByRole("button", { name: "Tilføj øl", exact: true }).click();
  await expect(page.getByText("Den her har I vist smagt før 👀")).toBeVisible();
  await expect(page.getByRole("img", { name: "Billede af øllen" })).toBeVisible();
  await page.getByRole("button", { name: "Tilføj alligevel" }).click();

  const beerId = await expectNewBeerPage(page, clubId, "Fotobajer");
  await expect(page.getByRole("img", { name: "Billede af Fotobajer" })).toBeVisible();
  // Scaled to at most 1200 px and stored as WebP.
  expect(await storedImage(beerId)).toEqual({
    content_type: "image/webp",
    width: 1200,
    height: 800,
  });

  // The event's beer card shows the photo.
  await page.goto(`/c/${clubId}/events/${eventId}`);
  const card = page.getByRole("link", { name: /Fotobajer/ });
  await expect(card.locator("img")).toBeVisible();
  const imageUrl = await card.locator("img").getAttribute("src");
  expect(imageUrl).toMatch(new RegExp(`/c/${clubId}/beers/${beerId}/image\\?v=\\d+$`));

  // Someone outside the club gets a 404 for the photo.
  const outsider = await openPage();
  await signUpWithClub(outsider, newUser(testInfo, "fremmed"), clubName(testInfo, "Anden"));
  const response = await outsider.request.get(imageUrl!);
  expect(response.status()).toBe(404);

  // Edit: remove the photo.
  await page.goto(`/c/${clubId}/beers/${beerId}/edit`);
  await expect(page.getByRole("img", { name: "Billede af øllen" })).toBeVisible();
  await page.getByRole("button", { name: "Fjern billede" }).click();
  await page.getByRole("button", { name: "Gem ændringer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fotobajer" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Billede af Fotobajer" })).toHaveCount(0);
  expect(await storedImage(beerId)).toBeNull();
});

test("en fil, der ikke er et billede, giver en fejl ved feltet", async ({ page }, testInfo) => {
  const clubId = await signUpWithClub(page, newUser(testInfo, "fejlfoto"), clubName(testInfo, "F"));
  await page.goto(`/c/${clubId}/beers/new`);
  await fillBeerForm(page, { name: "Ingen billedøl", abv: "4,6" });
  await page.getByLabel("Billede (valgfrit)").setInputFiles({
    name: "noter.png",
    mimeType: "image/png",
    buffer: Buffer.from("ikke et billede"),
  });
  await page.getByRole("button", { name: "Tilføj øl", exact: true }).click();
  await expect(
    page.getByText("Billedet kunne ikke læses. Brug et JPG- eller PNG-billede."),
  ).toBeVisible();
  // The name and ABV survive the failed submit.
  await expect(page.getByLabel("Navn")).toHaveValue("Ingen billedøl");
});
