import { expect, test } from "./fixtures";
import { clubName, createClub, expectHydrated, newUser, signUpWithClub } from "./support/app";
import { insertEvent, insertPlace, userIdByEmail } from "./support/db";
import {
  archivePlace,
  captureActionId,
  createPlaceViaForm,
  expectPlacePage,
  fillPlaceForm,
  hasHorizontalScroll,
  isServerActionCall,
  ownersRegion,
  placeOwnerEmails,
  placePath,
  placeRow,
  placesPath,
} from "./support/places";
import { at, dayFromToday, joinClub } from "./support/round2";

/**
 * Steder (SPEC §9.4, §5.1, D-095, D-100, D-101): create with address and "Det
 * er mit sted", the duplicate name refused with a link, any member edits, the
 * optimistic owner toggle, admins removing other owners, archive/restore/
 * delete with the right labels, club isolation (real 404s) and forged Server
 * Action calls. Events come ONLY from insertEvent (the event form is C's).
 */

const sorted = (items: string[]) => [...items].sort();

test.describe("Steder", () => {
  test("opret sted med adresse og “Det er mit sted”, dublet afvises med link, og et andet medlem retter", async ({
    page,
    openPage,
  }, testInfo) => {
    const owner = newUser(testInfo, "stedejer");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Steder"));

    // An empty club: the empty state invites the first place.
    await page.goto(placesPath(clubId));
    await expect(page.getByRole("heading", { level: 1, name: "Steder" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ingen steder endnu 📍" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Nyt sted" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nyt sted" })).toBeVisible();

    // The browser checks the name first and focuses it (D-056).
    const submit = page.getByRole("button", { name: "Opret sted" });
    await expectHydrated(submit);
    await submit.click();
    await expect(page.getByLabel("Navn")).toBeFocused();
    await expect(page.getByText("Giv stedet et navn.")).toBeVisible();

    await fillPlaceForm(page, {
      name: "Hos  Mads",
      address: "Søndergade 12, 8381 Tilst",
      description: "Ring på bagdøren\nTag skoene af",
      mine: true,
    });
    await submit.click();
    const placeId = await expectPlacePage(page, clubId, "Hos Mads");
    await expect(page.getByText("Stedet er oprettet 📍")).toBeVisible();
    await expect(page.getByRole("link", { name: /Åbn i kort/ })).toHaveAttribute(
      "href",
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Søndergade 12, 8381 Tilst")}`,
    );
    await expect(page.getByText(/Ring på bagdøren\s+Tag skoene af/)).toBeVisible();
    await expect(ownersRegion(page).getByRole("listitem")).toHaveCount(1);
    await expect(ownersRegion(page).getByRole("listitem")).toContainText(`${owner.name}(dig)`);
    await expect(
      ownersRegion(page).getByRole("button", { name: "Fjern mig som ejer" }),
    ).toBeVisible();
    expect(await placeOwnerEmails(placeId)).toEqual([owner.email]);
    // "Opret event her" pre-selects the place in the event form (C honours ?placeId=).
    await expect(page.getByRole("link", { name: "Opret event her" }).first()).toHaveAttribute(
      "href",
      `/c/${clubId}/events/new?placeId=${placeId}`,
    );

    // The same name in another spelling is refused, with a link to the place (D-095).
    await page.goto(`${placesPath(clubId)}/new`);
    await fillPlaceForm(page, { name: " hos   MADS " });
    await page.getByRole("button", { name: "Opret sted" }).click();
    await expect(
      page.getByText("Der findes allerede et sted, der hedder «Hos Mads»."),
    ).toBeVisible();
    await expect(page.getByLabel("Navn")).toBeFocused();
    await expect(page.getByLabel("Navn")).toHaveValue(" hos   MADS ");
    await page.getByRole("link", { name: "Gå til «Hos Mads»" }).click();
    expect(await expectPlacePage(page, clubId, "Hos Mads")).toBe(placeId);

    // Any member may edit it (§9.4, the democratic model).
    const member = newUser(testInfo, "stedmedlem");
    const memberPage = await openPage();
    await joinClub(page, memberPage, member, clubId);
    await memberPage.goto(placesPath(clubId));
    const card = memberPage.getByRole("link", { name: /Hos Mads/ });
    await expect(card).toContainText(`Ejer: ${owner.name}`);
    await expect(card).toContainText("Ikke brugt endnu");
    await expect(card).not.toContainText("Dit sted");
    await card.click();
    await expectPlacePage(memberPage, clubId, "Hos Mads");
    await memberPage.getByRole("link", { name: "Rediger" }).click();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Rediger sted" })).toBeVisible();
    await expect(memberPage.getByLabel("Navn")).toHaveValue("Hos Mads");
    await fillPlaceForm(memberPage, { description: "Ring på fordøren" });
    await memberPage.getByRole("button", { name: "Gem ændringer" }).click();
    await expectPlacePage(memberPage, clubId, "Hos Mads");
    await expect(memberPage.getByText("Gemt ✓")).toBeVisible();
    await expect(memberPage.getByText("Ring på fordøren")).toBeVisible();
  });

  test("ejer-toggle er optimistisk, ruller tilbage ved fejl og overlever reload; admin fjerner en ejer", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "stedadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Ejere"));
    const member = newUser(testInfo, "stedtoggle");
    const memberPage = await openPage();
    await joinClub(page, memberPage, member, clubId);
    const placeId = await insertPlace({
      clubId,
      name: "Hos Fælles",
      createdByEmail: admin.email,
      ownerEmails: [admin.email],
    });

    await memberPage.goto(placePath(clubId, placeId));
    const owners = ownersRegion(memberPage);
    await expect(owners.getByRole("listitem")).toHaveCount(1);
    // A member gets no X next to other owners (§5.1 note).
    await expect(owners.getByRole("button", { name: `Fjern ${admin.name} som ejer` })).toHaveCount(
      0,
    );

    // Optimistic (§13.4.6): with the answer held back, button and list change at once.
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await memberPage.route("**/*", async (route) => {
      if (!isServerActionCall(route.request())) return route.fallback();
      await released;
      await route.continue();
    });
    const claim = owners.getByRole("button", { name: "Det er mit sted" });
    await expectHydrated(claim);
    await claim.click();
    await expect(owners.getByRole("button", { name: "Fjern mig som ejer" })).toBeVisible();
    await expect(owners.getByRole("listitem")).toHaveCount(2);
    await expect(owners.getByRole("listitem").filter({ hasText: "(dig)" })).toContainText(
      member.name,
    );
    expect(await placeOwnerEmails(placeId)).toEqual([admin.email]);
    release();
    await expect(owners.getByRole("status")).toHaveText("Du er nu ejer af stedet.");
    await memberPage.unrouteAll({ behavior: "wait" });
    expect(await placeOwnerEmails(placeId)).toEqual(sorted([admin.email, member.email]));
    await memberPage.reload();
    await expect(owners.getByRole("button", { name: "Fjern mig som ejer" })).toBeVisible();

    // A failed save rolls back, with an error toast.
    await memberPage.route("**/*", (route) =>
      isServerActionCall(route.request()) ? route.abort() : route.fallback(),
    );
    const leave = owners.getByRole("button", { name: "Fjern mig som ejer" });
    await expectHydrated(leave);
    await leave.click();
    await expect(
      memberPage.getByText("Noget gik galt – prøv igen.", { exact: false }),
    ).toBeVisible();
    await expect(owners.getByRole("button", { name: "Fjern mig som ejer" })).toBeVisible();
    await expect(owners.getByRole("listitem")).toHaveCount(2);
    await memberPage.unrouteAll({ behavior: "wait" });
    expect(await placeOwnerEmails(placeId)).toEqual(sorted([admin.email, member.email]));

    // The admin removes the member as owner, after a confirmation (§15.1).
    await page.goto(placePath(clubId, placeId));
    const remove = ownersRegion(page).getByRole("button", {
      name: `Fjern ${member.name} som ejer`,
    });
    await expectHydrated(remove);
    await remove.click();
    const dialog = page.getByRole("alertdialog", {
      name: `Fjern ${member.name} som ejer af «Hos Fælles»?`,
    });
    await expect(dialog).toContainText(
      `${member.name} bliver ikke længere foreslået som vært her.`,
    );
    await dialog.getByRole("button", { name: "Fjern som ejer" }).click();
    await expect(page.getByText(`${member.name} er ikke længere ejer.`)).toBeVisible();
    await expect(ownersRegion(page).getByRole("listitem")).toHaveCount(1);
    expect(await placeOwnerEmails(placeId)).toEqual([admin.email]);
    // No X next to yourself: that is the toggle.
    await expect(
      ownersRegion(page).getByRole("button", { name: `Fjern ${admin.name} som ejer` }),
    ).toHaveCount(0);
  });

  test("arkivér et brugt sted, gendan det, navnekonflikt ved gendannelse, og slet et ubrugt", async ({
    page,
  }, testInfo) => {
    const admin = newUser(testInfo, "arkiv");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Arkiv"));
    const usedId = await insertPlace({
      clubId,
      name: "Det gamle klubhus",
      createdByEmail: admin.email,
    });
    const eventId = await insertEvent({
      clubId,
      createdByEmail: admin.email,
      title: "Smagning i klubhuset",
      startsAt: at(dayFromToday(-20), "19:00"),
      placeName: "Det gamle klubhus",
    });
    const unusedId = await insertPlace({ clubId, name: "Hos Ingen", createdByEmail: admin.email });

    // A used place: "Arkivér sted", and the confirmation says why it is not deleted (D-100).
    await page.goto(placePath(clubId, usedId));
    await expect(
      page.getByRole("region", { name: /Ølsmagninger her/ }).getByRole("link", {
        name: /Smagning i klubhuset/,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Slet sted" })).toHaveCount(0);
    const archive = page.getByRole("button", { name: "Arkivér sted" });
    await expectHydrated(archive);
    await archive.click();
    const dialog = page.getByRole("alertdialog", { name: "Arkivér «Det gamle klubhus»?" });
    await expect(dialog).toContainText(
      "Stedet er brugt til 1 ølsmagning, så det bliver ikke slettet.",
    );
    await dialog.getByRole("button", { name: "Arkivér sted" }).click();
    await expect(
      page.getByText("Stedet er arkiveret. De gamle events viser det stadig."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Arkiveret · vises ikke, når I vælger sted" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Opret event her" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Arkivér sted" })).toHaveCount(0);
    expect((await placeRow(usedId))?.archived).toBe(true);

    // Its event still shows it (E4).
    await page.goto(`/c/${clubId}/events/${eventId}`);
    await expect(page.getByRole("main").getByText("Det gamle klubhus").first()).toBeVisible();

    // Steder folds it away under "Arkiverede steder (1)".
    await page.goto(placesPath(clubId));
    const archivedCard = page.getByRole("link", { name: /Det gamle klubhus/ });
    await expect(archivedCard).toBeHidden();
    await page.getByText("Arkiverede steder (1)").click();
    await archivedCard.click();
    await expectPlacePage(page, clubId, "Det gamle klubhus");

    // "Gendan sted" (owner or admin) – a plain form, so it works before hydration too.
    await page.getByRole("button", { name: "Gendan sted" }).click();
    await expect(page.getByText("Stedet er gendannet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Opret event her" }).first()).toBeVisible();
    expect((await placeRow(usedId))?.archived).toBe(false);

    // Archived again, and meanwhile an active place took the name: restore is refused.
    await archivePlace(usedId);
    await insertPlace({ clubId, name: "det gamle  KLUBHUS", createdByEmail: admin.email });
    await page.reload();
    await page.getByRole("button", { name: "Gendan sted" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Der findes allerede et aktivt sted, der hedder «det gamle KLUBHUS».",
    );
    expect((await placeRow(usedId))?.archived).toBe(true);
    await page.getByRole("link", { name: "Gå til «det gamle KLUBHUS»" }).click();
    await expectPlacePage(page, clubId, "det gamle KLUBHUS");

    // An unused place is deleted outright.
    await page.goto(placePath(clubId, unusedId));
    await expect(page.getByRole("region", { name: "Ølsmagninger her" })).toContainText(
      "Ingen ølsmagninger her endnu.",
    );
    await expect(page.getByRole("button", { name: "Arkivér sted" })).toHaveCount(0);
    const remove = page.getByRole("button", { name: "Slet sted" });
    await expectHydrated(remove);
    await remove.click();
    const confirm = page.getByRole("alertdialog", { name: "Slet «Hos Ingen»?" });
    await expect(confirm).toContainText("så det bliver slettet helt");
    await confirm.getByRole("button", { name: "Slet sted" }).click();
    await expect(page.getByText("Stedet er slettet.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/places$`));
    expect(await placeRow(unusedId)).toBeNull();
  });

  test("et sted fra en anden klub og et ugyldigt id giver en ægte 404", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "stedisolation");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Isolation"));
    const otherClubId = await createClub(page, clubName(testInfo, "Anden"));
    const otherPlaceId = await insertPlace({
      clubId: otherClubId,
      name: "Hemmeligt sted",
      createdByEmail: owner.email,
    });

    for (const path of [
      `places/${otherPlaceId}`,
      `places/${otherPlaceId}/edit`,
      "places/ikke-et-id",
      "places/ikke-et-id/edit",
    ]) {
      const response = await page.goto(`/c/${clubId}/${path}`);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByText(/Hemmeligt/)).toHaveCount(0);
    }
  });

  test("forfalskede ejerskabskald for en anden bruger bliver afvist", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "forfalskadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Forfalsk"));
    const member = newUser(testInfo, "forfalsker");
    const memberPage = await openPage();
    await joinClub(page, memberPage, member, clubId);
    const adminId = await userIdByEmail(admin.email);
    const placeId = await insertPlace({
      clubId,
      name: "Hos Begge",
      createdByEmail: admin.email,
      ownerEmails: [admin.email, member.email],
    });
    const bothOwners = sorted([admin.email, member.email]);

    // The id of "remove another owner", from the admin's X (aborted, so nothing happens).
    await page.goto(placePath(clubId, placeId));
    const x = ownersRegion(page).getByRole("button", { name: `Fjern ${member.name} som ejer` });
    await expectHydrated(x);
    await x.click();
    const removeOwnerActionId = await captureActionId(page, () =>
      page.getByRole("alertdialog").getByRole("button", { name: "Fjern som ejer" }).click(),
    );
    expect(await placeOwnerEmails(placeId)).toEqual(bothOwners);

    // The member's own toggle, rewritten to remove the ADMIN as owner: refused (FORBIDDEN).
    await memberPage.goto(placePath(clubId, placeId));
    const toggle = ownersRegion(memberPage).getByRole("button", { name: "Fjern mig som ejer" });
    await expectHydrated(toggle);
    await memberPage.route("**/*", async (route) => {
      const request = route.request();
      if (!isServerActionCall(request)) return route.fallback();
      await route.continue({
        headers: { ...request.headers(), "next-action": removeOwnerActionId },
        postData: JSON.stringify([clubId, placeId, adminId]),
      });
    });
    await toggle.click();
    await expect(
      memberPage.getByText("Kun klubbens admins kan fjerne andre som ejere."),
    ).toBeVisible();
    expect(await placeOwnerEmails(placeId)).toEqual(bothOwners);
    await memberPage.unrouteAll({ behavior: "wait" });

    // The toggle with another user's id added: the action has no such argument,
    // so only the caller's own ownership changes.
    await memberPage.reload();
    await expectHydrated(toggle);
    await memberPage.route("**/*", async (route) => {
      const request = route.request();
      if (!isServerActionCall(request)) return route.fallback();
      await route.continue({ postData: JSON.stringify([clubId, placeId, false, adminId]) });
    });
    await toggle.click();
    await expect(ownersRegion(memberPage).getByRole("status")).toHaveText(
      "Du er ikke længere ejer af stedet.",
    );
    expect(await placeOwnerEmails(placeId)).toEqual([admin.email]);
  });

  test("et navn på 120 tegn og en adresse på 200 tegn giver ingen vandret scroll", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "langtnavn");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Lange"));
    // Long unbroken words, the worst case for wrapping (F-028/F-047).
    const name = `Hos ${"Bryggeriforeningsmødelokale".repeat(5)}`.slice(0, 120);
    const address = `Søndergade 12, ${"Vestergaardsalléafdelingen".repeat(8)}`.slice(0, 200);
    const placeId = await createPlaceViaForm(page, clubId, { name, address, mine: true });
    expect(await placeRow(placeId)).toMatchObject({ name, address });
    expect(await hasHorizontalScroll(page)).toBe(false);

    for (const path of [placesPath(clubId), `${placePath(clubId, placeId)}/edit`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await hasHorizontalScroll(page), path).toBe(false);
    }
  });
});
