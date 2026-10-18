import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clubName,
  expectHydrated,
  mainNav,
  newUser,
  profileLink,
  signUp,
  signUpWithClub,
} from "./support/app";
import {
  appAdmin,
  createFeedback,
  expectFeedbackPage,
  feedbackCard,
  feedbackRow,
  feedbackTitle,
  feedbackVoteCount,
  filterGroup,
  setFeedbackStatus,
  signUpOrLogIn,
  submitFeedbackForm,
  votesRegion,
} from "./support/feedback";
import { hasHorizontalScroll } from "./support/places";

/**
 * Feedback (SPEC §9.9, D-141–D-150): the way in from Profil and from the
 * 0-club footer, creating and editing a report, 👍 from another user, the
 * page without the club id (E26), the app-admin's technical info, status,
 * answer and duplicate, deleting, the filters, real 404s, the login redirect
 * and no sideways scrolling at 375 px.
 *
 * Feedback is app-wide: parallel tests (and both projects) see each other's
 * reports, so nothing here assumes an empty list or an exact count. Titles
 * are unique (feedbackTitle) and cards are found by title or under "Mine
 * rapporter".
 */

const DESCRIPTION = "Når jeg trykker på knappen, sker der ingenting.\nPrøvet to gange.";

/** A user without a club: lands on /onboarding after signing up. */
async function signUpWithoutClub(page: Page, user: ReturnType<typeof newUser>): Promise<void> {
  await signUp(page, user);
  await expect(page).toHaveURL(/\/onboarding$/);
}

test.describe("Feedback", () => {
  test("Profil → Feedback → ny idé, ret den mens den er Ny, og find den under Mine rapporter", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "feedback");
    await signUpWithClub(page, user, clubName(testInfo, "Feedback"));

    // Profil → "Feedback (fejl og ønsker)" (§8.1); Profil stays the active tab (D-147).
    await profileLink(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Feedback" })
      .getByRole("link", { name: /^Feedback \(fejl og ønsker\)/ })
      .click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole("heading", { level: 1, name: "Feedback" })).toBeVisible();
    await expect(profileLink(page)).toHaveAttribute("aria-current", "page");
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(1);

    await page.getByRole("main").getByRole("link", { name: "Ny rapport" }).first().click();
    await expect(page).toHaveURL(/\/feedback\/new$/);
    // An idea has no "Side" (shown only for a bug, with CSS).
    await page.getByRole("radio", { name: "Idé / ønske" }).check();
    await expect(page.getByLabel(/^Side/)).toBeHidden();
    await expect(page.getByLabel("Beskrivelse")).toHaveAttribute(
      "placeholder",
      "Hvad vil du gerne kunne, og hvorfor?",
    );

    const title = feedbackTitle(testInfo, "Mørkt tema til baren");
    const id = await submitFeedbackForm(page, {
      type: "FEATURE",
      title,
      description: "Et mørkt tema ville være rart, når lyset er dæmpet.",
    });
    await expect(page.getByText("Ny", { exact: true })).toBeVisible();
    await expect(page.getByText("Din rapport tæller automatisk som 1 👍")).toBeVisible();
    await expect(votesRegion(page)).toContainText("👍 1");
    await expect(votesRegion(page).getByRole("button")).toHaveCount(0);
    // An idea keeps no page and no technical info (D-141).
    expect(await feedbackRow(id)).toMatchObject({
      status: "NEW",
      page_path: null,
      user_agent: null,
      viewport_width: null,
    });

    // The author edits the title while the report is Ny.
    await page.getByRole("link", { name: "Ret", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ret rapport" })).toBeVisible();
    const renamed = `${title} (rettet)`;
    await page.getByLabel("Titel").fill(renamed);
    await page.getByRole("button", { name: "Gem", exact: true }).click();
    await expectFeedbackPage(page, renamed);
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    // "Mine rapporter" (?mine=1) shows it.
    await page.goto("/feedback");
    await filterGroup(page, "Vis").getByRole("link", { name: "Mine rapporter" }).click();
    await expect(page).toHaveURL(/\/feedback\?mine=1$/);
    await expect(
      filterGroup(page, "Vis").getByRole("link", { name: "Mine rapporter" }),
    ).toHaveAttribute("aria-current", "true");
    await expect(feedbackCard(page, renamed)).toBeVisible();
    await expect(feedbackCard(page, renamed)).toContainText("👍 1");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("en anden bruger giver 👍, ser “(du har stemt)” og fjerner den igen", async ({
    page,
    openPage,
  }, testInfo) => {
    const author = newUser(testInfo, "forfatter");
    await signUpWithoutClub(page, author);
    const title = feedbackTitle(testInfo, "Statistik over øltyper");
    const id = await createFeedback(page, { type: "FEATURE", title, description: DESCRIPTION });

    const voterPage = await openPage();
    const voter = newUser(testInfo, "stemmer");
    await signUpWithoutClub(voterPage, voter);
    await voterPage.goto(`/feedback/${id}`);
    await expectFeedbackPage(voterPage, title);
    await expect(votesRegion(voterPage)).toContainText("👍 1");
    const upvote = votesRegion(voterPage).getByRole("button", {
      name: "👍 Det vil jeg også gerne have",
    });
    await expectHydrated(upvote);
    await upvote.click();
    await expect(votesRegion(voterPage)).toContainText("👍 2");
    await expect(
      votesRegion(voterPage).getByRole("button", { name: "Fjern min 👍" }),
    ).toBeVisible();
    await expect.poll(() => feedbackVoteCount(id)).toBe(1);

    // The list shows the count and that the voter has voted.
    await voterPage.goto("/feedback?sort=newest");
    await expect(feedbackCard(voterPage, title)).toContainText("👍 2");
    await expect(feedbackCard(voterPage, title)).toContainText("(du har stemt)");

    // … and the author sees 2 without "(du har stemt)".
    await page.goto("/feedback?mine=1");
    await expect(feedbackCard(page, title)).toContainText("👍 2");
    await expect(feedbackCard(page, title)).not.toContainText("(du har stemt)");

    // The voter takes the 👍 back.
    await voterPage.goto(`/feedback/${id}`);
    const remove = votesRegion(voterPage).getByRole("button", { name: "Fjern min 👍" });
    await expectHydrated(remove);
    await remove.click();
    await expect(votesRegion(voterPage)).toContainText("👍 1");
    await expect(
      votesRegion(voterPage).getByRole("button", { name: "👍 Det vil jeg også gerne have" }),
    ).toBeVisible();
    await expect.poll(() => feedbackVoteCount(id)).toBe(0);
  });

  test("“Rapportér en fejl” med siden udfyldt: klub-id'et når aldrig rapporten (E26)", async ({
    page,
    openPage,
  }, testInfo) => {
    const user = newUser(testInfo, "fejlfinder");
    const name = clubName(testInfo, "Fejlklub");
    const clubId = await signUpWithClub(page, user, name);

    await page.goto(`/feedback/new?type=bug&page=${encodeURIComponent(`/c/${clubId}/calendar`)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Ny rapport" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Fejl" })).toBeChecked();
    await expect(page.getByLabel(/^Side/)).toHaveValue("/calendar");
    await expect(page.getByLabel("Beskrivelse")).toHaveAttribute(
      "placeholder",
      "Hvad skete der? Hvad forventede du? Hvordan kan vi gentage fejlen?",
    );
    expect(await hasHorizontalScroll(page)).toBe(false);

    const title = feedbackTitle(testInfo, "Kalenderen viser forkert dato");
    await expectHydrated(page.getByRole("button", { name: "Send" }));
    await page.getByLabel("Titel").fill(title);
    await page.getByLabel("Beskrivelse").fill(DESCRIPTION);
    await page.getByRole("button", { name: "Send" }).click();
    const id = await expectFeedbackPage(page, title);
    await expect(page.getByText("Side: /calendar")).toBeVisible();
    // The description is plain text and keeps its line break.
    expect(await page.getByRole("region", { name: "Beskrivelse" }).innerText()).toContain(
      "sker der ingenting.\nPrøvet to gange.",
    );
    expect(await hasHorizontalScroll(page)).toBe(false);

    const row = await feedbackRow(id);
    expect(row?.page_path).toBe("/calendar");
    expect(row?.user_agent).toBeTruthy();
    expect(row?.viewport_width).toBe(page.viewportSize()?.width);

    // Someone outside the club sees the report, but nothing of the club.
    const otherPage = await openPage();
    await signUpWithoutClub(otherPage, newUser(testInfo, "udenfor"));
    const response = await otherPage.goto(`/feedback/${id}`);
    expect(response?.status()).toBe(200);
    await expectFeedbackPage(otherPage, title);
    const html = (await response?.text()) ?? "";
    expect(html).toContain(title);
    expect(html).not.toContain(clubId);
    expect(html).not.toContain(name);
  });

  test("app-admin ser teknisk info, sætter status og svar og markerer en dublet", async ({
    page,
    openPage,
  }, testInfo) => {
    const author = newUser(testInfo, "rapporter");
    await signUpWithoutClub(page, author);
    const originalTitle = feedbackTitle(testInfo, "Knappen Gem reagerer ikke");
    const originalId = await createFeedback(page, {
      type: "BUG",
      title: originalTitle,
      description: DESCRIPTION,
    });
    const duplicateTitle = feedbackTitle(testInfo, "Gem-knap virker ikke");
    const duplicateId = await createFeedback(page, {
      type: "BUG",
      title: duplicateTitle,
      description: DESCRIPTION,
    });
    const userAgent = (await feedbackRow(originalId))?.user_agent ?? "";
    expect(userAgent).not.toBe("");

    // The app-admin (APP_ADMIN_EMAILS) sees the technical info and the status form.
    const adminPage = await openPage();
    await signUpOrLogIn(adminPage, appAdmin(testInfo));
    await adminPage.goto(`/feedback/${originalId}`);
    await expectFeedbackPage(adminPage, originalTitle);
    const tech = adminPage.getByRole("region", { name: "Teknisk info (kun synlig for dig)" });
    await expect(tech).toContainText("Browser/enhed");
    await expect(tech).toContainText(userAgent);
    await expect(tech).toContainText(`${page.viewportSize()?.width} px`);
    expect(await hasHorizontalScroll(adminPage)).toBe(false);

    const answer = "Giver mening – planlagt efter afstemninger";
    await adminPage.getByLabel("Status").selectOption({ label: "Planlagt" });
    await adminPage.getByLabel(/^Svar/).fill(answer);
    await adminPage.getByRole("button", { name: "Gem", exact: true }).click();
    await expect(adminPage.getByText("Status er gemt ✓")).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Svar fra app-admin" })).toBeVisible();
    expect(await feedbackRow(originalId)).toMatchObject({
      status: "PLANNED",
      admin_response: answer,
    });

    // The author sees Planlagt and the answer, and can no longer edit or delete.
    await page.goto(`/feedback/${originalId}`);
    await expect(page.getByText("Planlagt", { exact: true })).toBeVisible();
    await expect(page.getByText(answer)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ret", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Slet rapport" })).toHaveCount(0);
    const authorHtml = (await (await page.request.get(`/feedback/${originalId}`)).text()) ?? "";
    expect(authorHtml).not.toContain("Teknisk info");
    expect(authorHtml).not.toContain(userAgent);
    // The edit page is a real 404 once the report is no longer Ny (D-148).
    expect((await page.goto(`/feedback/${originalId}/edit`))?.status()).toBe(404);

    // The admin marks the second report as a duplicate of the first.
    await adminPage.goto(`/feedback/${duplicateId}`);
    await expectFeedbackPage(adminPage, duplicateTitle);
    const original = adminPage.getByLabel("Original rapport");
    await expect(original).toBeHidden();
    await adminPage.getByLabel("Status").selectOption({ label: "Dublet" });
    await expect(original).toBeVisible();
    await original.selectOption({ label: `🐞 ${originalTitle}` });
    await adminPage.getByRole("button", { name: "Gem", exact: true }).click();
    await expect(adminPage.getByText("Status er gemt ✓")).toBeVisible();
    expect((await feedbackRow(duplicateId))?.duplicate_of_id).toBe(originalId);

    await page.goto(`/feedback/${duplicateId}`);
    await expect(page.getByText(`Dublet af «${originalTitle}»`)).toBeVisible();
    await page.getByRole("link", { name: `«${originalTitle}»` }).click();
    await expectFeedbackPage(page, originalTitle);
  });

  test("slet en rapport mens den er Ny – med bekræftelse", async ({ page }, testInfo) => {
    const user = newUser(testInfo, "sletter");
    await signUpWithoutClub(page, user);
    const title = feedbackTitle(testInfo, "Forkert ikon på knappen");
    const id = await createFeedback(page, { type: "BUG", title, description: DESCRIPTION });

    const remove = page.getByRole("button", { name: "Slet rapport" });
    await expectHydrated(remove);
    await remove.click();
    const dialog = page.getByRole("alertdialog", { name: "Slet rapporten?" });
    await expect(dialog).toContainText("Rapporten og dens 👍 slettes. Det kan ikke fortrydes.");
    await dialog.getByRole("button", { name: "Slet rapport" }).click();

    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByText("Rapporten er slettet.")).toBeVisible();
    expect(await feedbackRow(id)).toBeNull();
    expect((await page.goto(`/feedback/${id}`))?.status()).toBe(404);
  });

  test("filtre og sortering ligger i URL'en og viser de rigtige rapporter", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "filtrerer");
    await signUpWithoutClub(page, user);
    const bugTitle = feedbackTitle(testInfo, "Filterfejl");
    const bugId = await createFeedback(page, {
      type: "BUG",
      title: bugTitle,
      description: DESCRIPTION,
    });
    const ideaTitle = feedbackTitle(testInfo, "Filterønske");
    await createFeedback(page, { type: "FEATURE", title: ideaTitle, description: DESCRIPTION });

    // Mine rapporter, newest first.
    await page.goto("/feedback");
    await filterGroup(page, "Vis").getByRole("link", { name: "Mine rapporter" }).click();
    await expect(page).toHaveURL(/\/feedback\?mine=1$/);
    await filterGroup(page, "Sortér").getByRole("link", { name: "Nyeste" }).click();
    await expect(page).toHaveURL(/\/feedback\?mine=1&sort=newest$/);
    const cards = page.getByRole("list", { name: "Rapporter" }).getByRole("link");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText(ideaTitle);
    await expect(cards.last()).toContainText(bugTitle);

    // Type: Fejl, then Ønsker.
    await filterGroup(page, "Type").getByRole("link", { name: "🐞 Fejl" }).click();
    await expect(page).toHaveURL(/\/feedback\?type=bug&mine=1&sort=newest$/);
    await expect(feedbackCard(page, bugTitle)).toBeVisible();
    await expect(feedbackCard(page, ideaTitle)).toHaveCount(0);
    await expect(filterGroup(page, "Type").getByRole("link", { name: "🐞 Fejl" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await filterGroup(page, "Type").getByRole("link", { name: "💡 Ønsker" }).click();
    await expect(page).toHaveURL(/\/feedback\?type=feature&mine=1&sort=newest$/);
    await expect(feedbackCard(page, ideaTitle)).toBeVisible();
    await expect(feedbackCard(page, bugTitle)).toHaveCount(0);

    // Lukkede: only the bug once it is done (set directly; moderation is tested above).
    await setFeedbackStatus(bugId, "DONE");
    await filterGroup(page, "Type").getByRole("link", { name: "Alle" }).click();
    await expect(page).toHaveURL(/\/feedback\?mine=1&sort=newest$/);
    await expect(feedbackCard(page, ideaTitle)).toBeVisible();
    await expect(feedbackCard(page, bugTitle)).toHaveCount(0);
    await filterGroup(page, "Status").getByRole("link", { name: "Lukkede" }).click();
    await expect(page).toHaveURL(/\/feedback\?status=closed&mine=1&sort=newest$/);
    await expect(feedbackCard(page, bugTitle)).toContainText("Færdig ✓");
    await expect(feedbackCard(page, ideaTitle)).toHaveCount(0);
    await filterGroup(page, "Status").getByRole("link", { name: "Alle" }).click();
    await expect(page).toHaveURL(/\/feedback\?status=all&mine=1&sort=newest$/);
    await expect(cards).toHaveCount(2);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("ukendte og ugyldige id'er og andres redigering giver en ægte 404", async ({
    page,
    openPage,
  }, testInfo) => {
    const user = newUser(testInfo, "fireoghalvfems");
    await signUpWithoutClub(page, user);

    const unknown = await page.goto("/feedback/019a0c1e-7d2b-7c3a-9f00-1234567890ab");
    expect(unknown?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: /Den her øl er vist drukket/ }),
    ).toBeVisible();
    expect((await page.goto("/feedback/ikke-et-id"))?.status()).toBe(404);
    expect((await page.goto("/feedback/ikke-et-id/edit"))?.status()).toBe(404);

    // Someone else's report: readable, but its edit page is a 404.
    const title = feedbackTitle(testInfo, "Andens rapport");
    const id = await createFeedback(page, { type: "FEATURE", title, description: DESCRIPTION });
    const otherPage = await openPage();
    await signUpWithoutClub(otherPage, newUser(testInfo, "nysgerrig"));
    expect((await otherPage.goto(`/feedback/${id}`))?.status()).toBe(200);
    await expect(otherPage.getByRole("link", { name: "Ret", exact: true })).toHaveCount(0);
    await expect(otherPage.getByRole("button", { name: "Slet rapport" })).toHaveCount(0);
    expect((await otherPage.goto(`/feedback/${id}/edit`))?.status()).toBe(404);
  });

  test("logget ud sendes /feedback til login og tilbage", async ({ page }) => {
    await page.goto("/feedback");
    await expect(page).toHaveURL(/\/login\?next=%2Ffeedback$/);
  });

  test("en bruger uden klub finder Feedback fra onboarding og kan oprette en rapport", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "klubloes");
    await signUpWithoutClub(page, user);

    await page.getByRole("link", { name: "Feedback", exact: true }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole("heading", { level: 1, name: "Feedback" })).toBeVisible();
    // FeedbackShell: no club navigation, a way back and who is logged in.
    await expect(page.getByRole("navigation", { name: "Hovednavigation" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tilbage" })).toHaveAttribute("href", "/");
    await expect(page.getByText(`Logget ind som ${user.email}`)).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    // A fresh user has sent nothing yet.
    await filterGroup(page, "Vis").getByRole("link", { name: "Mine rapporter" }).click();
    await expect(
      page.getByRole("heading", { name: "Du har ikke sendt nogen rapporter endnu." }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Ny rapport" }).first().click();
    const title = feedbackTitle(testInfo, "Kan ikke finde min klubkode");
    await submitFeedbackForm(page, { type: "BUG", title, description: DESCRIPTION });
    await expect(page.getByText("Din rapport tæller automatisk som 1 👍")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("lange ord i titel og beskrivelse giver ingen vandret scroll (F-047)", async ({
    page,
  }, testInfo) => {
    await signUpWithoutClub(page, newUser(testInfo, "langord"));
    const longWord = "Ølsmagningskalenderopdateringsproblemstillingsbeskrivelse".repeat(2);
    // ≤ 120 characters with the unique suffix.
    const title = feedbackTitle(testInfo, longWord.slice(0, 95));
    await page.goto("/feedback/new");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await submitFeedbackForm(page, {
      type: "FEATURE",
      title,
      description: `${longWord}${longWord} https://example.com/${"a".repeat(150)}`,
    });
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.goto("/feedback?mine=1");
    await expect(feedbackCard(page, title)).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
