import { expect, test } from "./fixtures";
import {
  deleteMembership,
  insertBeer,
  insertEvent,
  insertPlace,
  lastActiveClubId,
} from "./support/db";
import {
  clubName,
  createClub,
  expectOverview,
  mainNav,
  newUser,
  readInvitePath,
  signUp,
  signUpWithClub,
} from "./support/app";
import { joinClub } from "./support/round2";

/** Club isolation (SPEC §4.4, D-012, E16, E22): other clubs and bad ids are 404, never 403/500. */

const NOT_FOUND_HEADING = "Den her øl er vist drukket.";

test.describe("Club isolation", () => {
  test("et ikke-medlem og ugyldige id'er får 404 uden at se klubben", async ({
    page,
    openPage,
  }, testInfo) => {
    const owner = newUser(testInfo, "ejer");
    const name = clubName(testInfo, "Hemmelig");
    const clubId = await signUpWithClub(page, owner, name);

    const outsiderPage = await openPage();
    const outsider = newUser(testInfo, "udenforstaaende");
    await signUp(outsiderPage, outsider);
    await expect(outsiderPage).toHaveURL(/\/onboarding$/);

    const paths = [
      `/c/${clubId}`,
      `/c/${clubId}/club`,
      `/c/${clubId}/profile`,
      `/c/${clubId}/calendar`,
      `/c/${clubId}/places`,
      // Unknown sub-routes ([...rest]) and bad resource ids reveal nothing either.
      `/c/${clubId}/polls`,
      `/c/${clubId}/events/123`,
      `/c/${clubId}/places/123`,
      "/c/ikke-et-id",
      "/c/ikke-et-id/club",
      "/c/ikke-et-id/places",
      // Well-formed, but no such club.
      "/c/0199a000-0000-7000-8000-000000000000",
    ];
    for (const path of paths) {
      const response = await outsiderPage.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(
        outsiderPage.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING }),
      ).toBeVisible();
      await expect(outsiderPage.getByText(name)).toHaveCount(0);
    }

    // The owner still gets in.
    const response = await page.goto(`/c/${clubId}/club`);
    expect(response?.status()).toBe(200);
  });

  test("ukendte undersider og ressourcer fra en anden klub giver en ægte 404 inde i klubben, uden at skifte aktiv klub", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "undersider");
    const name = clubName(testInfo, "Undersider");
    const clubId = await signUpWithClub(page, owner, name);
    const otherId = await createClub(page, clubName(testInfo, "Aktivklub"));
    await expect.poll(() => lastActiveClubId(owner.email)).toBe(otherId);

    // A real place, event and beer – in the OTHER club (E22: the id exists, but not here).
    const otherPlaceId = await insertPlace({
      clubId: otherId,
      name: "Hemmeligt sted",
      createdByEmail: owner.email,
    });
    const otherEventId = await insertEvent({
      clubId: otherId,
      createdByEmail: owner.email,
      title: "Hemmelig smagning",
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      placeName: "Hemmeligt sted",
    });
    const otherBeerId = await insertBeer({
      clubId: otherId,
      createdByEmail: owner.email,
      name: "Hemmelig Bajer",
      eventId: otherEventId,
    });
    const unknownId = "0199a000-0000-7000-8000-000000000000";

    for (const path of [
      "polls",
      "places/123",
      `places/${unknownId}`,
      `places/${otherPlaceId}`,
      `places/${otherPlaceId}/edit`,
      "events",
      "events/123",
      `events/${unknownId}`,
      `events/${unknownId}/edit`,
      `events/${otherEventId}`,
      `events/${otherEventId}/edit`,
      "beers/123/edit",
      `beers/${unknownId}`,
      `beers/${otherBeerId}`,
      `beers/${otherBeerId}/edit`,
    ]) {
      // No loading.tsx above these routes (TG-008): a real 404 status, not a
      // streamed "soft" 404. Next marks it noindex as well.
      const response = await page.goto(`/c/${clubId}/${path}`);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING })).toBeVisible();
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
      // Inside the AppShell: the club's navigation and name are still there.
      await expect(mainNav(page).getByRole("link", { name: "Overblik" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Skift klub/ })).toContainText(name);
      await expect(page.getByText(/Hemmelig/)).toHaveCount(0);
    }
    // An unknown URL does not make the club the active one.
    expect(await lastActiveClubId(owner.email)).toBe(otherId);

    // In their own club, the same ids work (h1 = the event title / the beer / the place name).
    for (const path of [
      `events/${otherEventId}`,
      `beers/${otherBeerId}`,
      `places/${otherPlaceId}`,
    ]) {
      const response = await page.goto(`/c/${otherId}/${path}`);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: /Hemmelig/ })).toBeVisible();
    }

    // Real pages still win over the catch-all.
    const response = await page.goto(`/c/${clubId}/events/new`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Opret event" })).toBeVisible();
  });

  test("et medlem, der ikke må redigere, får 404 på redigeringssiderne uden at skifte aktiv klub", async ({
    page,
    openPage,
  }, testInfo) => {
    const owner = newUser(testInfo, "redigejer");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Redigering"));
    const eventId = await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Ejerens smagning",
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    const beerId = await insertBeer({ clubId, createdByEmail: owner.email, name: "Ejerens Bajer" });

    // An ordinary member (not the creator) whose active club is another one.
    const memberPage = await openPage();
    const member = newUser(testInfo, "redigmedlem");
    await joinClub(page, memberPage, member, clubId);
    const otherId = await createClub(memberPage, clubName(testInfo, "Medlemsklub"));
    await expect.poll(() => lastActiveClubId(member.email)).toBe(otherId);

    // club/edit: admins only (D-110), a real 404 for members (no loading.tsx, D-108).
    for (const path of [`events/${eventId}/edit`, `beers/${beerId}/edit`, "club/edit"]) {
      const response = await memberPage.goto(`/c/${clubId}/${path}`);
      expect(response?.status(), path).toBe(404);
      await expect(
        memberPage.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING }),
      ).toBeVisible();
    }
    // The permission 404 did not make the club the active one (D-066).
    expect(await lastActiveClubId(member.email)).toBe(otherId);
    await memberPage.goto("/");
    await expectOverview(memberPage, otherId);
  });

  test("et medlem, der fjernes, mens appen er åben, får 404 ved næste klik (E16)", async ({
    page,
    openPage,
  }, testInfo) => {
    const owner = newUser(testInfo, "fjerner");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Udsmidning"));
    const invitePath = await readInvitePath(page);

    const memberPage = await openPage();
    const member = newUser(testInfo, "fjernet");
    await signUp(memberPage, member, { next: invitePath });
    await memberPage.getByRole("button", { name: "Join klub" }).click();
    await expectOverview(memberPage, clubId);

    await deleteMembership(member.email, clubId);

    await mainNav(memberPage).getByRole("link", { name: "Kalender" }).click();
    await expect(
      memberPage.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING }),
    ).toBeVisible();

    // "Gå til forsiden" → "/" routes on (§10.1): no clubs left → onboarding.
    await memberPage.getByRole("link", { name: "Gå til forsiden" }).click();
    await expect(memberPage).toHaveURL(/\/onboarding$/);
  });
});
