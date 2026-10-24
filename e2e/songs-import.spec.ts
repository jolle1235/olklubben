import { buildPdf } from "../tests/support/pdf";

import { expect, test } from "./fixtures";
import { clubName, newUser, readInvitePath, signUpWithClub } from "./support/app";
import { joinClub } from "./support/members";

/**
 * Importér fra PDF (SPEC §9.6, D-156): an admin picks PDFs from the empty
 * songbook, checks the review list, corrects a title and imports. A file
 * imported before comes back as "Filen er importeret før" and stays unticked.
 * Made-up songs only (SPEC §19.1 rule 10).
 */

const pdf = (title: string, line: string) => ({
  mimeType: "application/pdf",
  buffer: Buffer.from(
    buildPdf([
      { text: title, x: 72, y: 720, size: 20 },
      { text: line, x: 72, y: 690, size: 11 },
      { text: "og skummet stiger op", x: 72, y: 676, size: 11 },
    ]),
  ),
});

test("en admin importerer sange fra PDF'er og retter en titel undervejs", async ({
  page,
}, testInfo) => {
  await signUpWithClub(page, newUser(testInfo, "sangimport"), clubName(testInfo, "Sangklub"));
  const clubPath = new URL(page.url()).pathname;

  await page.goto(`${clubPath}/songs`);
  await expect(page.getByRole("heading", { name: "Sangbogen er tom endnu 🎵" })).toBeVisible();
  await page.getByRole("link", { name: "Importér fra PDF" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Importér sange" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles([
    { name: "humlevise.pdf", ...pdf("HUMLEVISE", "Humle i haven hele dagen") },
    { name: "maltsang.pdf", ...pdf("MALTSANG", "Malt i sækken, malt i karret") },
  ]);

  const list = page.getByRole("region", { name: "Sange fra PDF'erne" });
  await expect(list.getByText("Humlevise", { exact: true })).toBeVisible();
  await expect(list.getByText("Maltsang", { exact: true })).toBeVisible();
  await expect(list.getByText("Ren tekst", { exact: true })).toHaveCount(2);
  await expect(list.getByRole("heading", { name: "2 sange valgt af 2" })).toBeVisible();

  // Open the second song and give it a new title.
  await list.getByRole("button", { name: "Vis og ret" }).nth(1).click();
  await list.getByLabel("Titel").fill("Maltsangen");
  await expect(list.getByText("Maltsangen", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Importér 2 sange" }).click();
  await expect(page).toHaveURL(new RegExp(`${clubPath}/songs(\\?|$)`));
  await expect(page.getByText("Sangene er importeret 🎵")).toBeVisible();
  await expect(page.getByRole("link", { name: /Humlevise/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maltsangen/ })).toBeVisible();

  // The same file again: recognised, not ticked, and nothing to import.
  await page.goto(`${clubPath}/songs/import`);
  await page
    .locator('input[type="file"]')
    .setInputFiles([{ name: "humlevise.pdf", ...pdf("HUMLEVISE", "Humle i haven hele dagen") }]);
  await expect(list.getByText(/Filen er importeret før/)).toBeVisible();
  await expect(list.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Vælg de sange, der skal med" })).toBeDisabled();
});

test("et medlem ser ingen import og får 404 på siden", async ({ page, openPage }, testInfo) => {
  const clubId = await signUpWithClub(
    page,
    newUser(testInfo, "sangejer"),
    clubName(testInfo, "Sangklub"),
  );
  const invitePath = await readInvitePath(page);
  const memberPage = await openPage();
  await joinClub(memberPage, newUser(testInfo, "sanger"), invitePath, clubId);

  await memberPage.goto(`/c/${clubId}/songs`);
  await expect(
    memberPage.getByRole("heading", { name: "Sangbogen er tom endnu 🎵" }),
  ).toBeVisible();
  await expect(memberPage.getByRole("link", { name: "Importér fra PDF" })).toHaveCount(0);
  const response = await memberPage.goto(`/c/${clubId}/songs/import`);
  expect(response?.status()).toBe(404);
});
