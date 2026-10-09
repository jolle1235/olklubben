import { expect, test } from "./fixtures";
import { deleteMembership, lastActiveClubId } from "./support/db";
import {
  clubName,
  createClub,
  expectOverview,
  logIn,
  logOut,
  newUser,
  profileLink,
  signUp,
  signUpWithClub,
} from "./support/app";

/**
 * Headers of an automatic Link prefetch (as from the /clubs picker) of
 * /c/<id>: it renders the club layout down to loading.tsx, not the page.
 * `next dev` never prefetches, so the test sends one itself.
 */
const PREFETCH_FROM_CLUBS = {
  RSC: "1",
  "Next-Router-Prefetch": "1",
  "Next-Router-State-Tree": encodeURIComponent(
    JSON.stringify([
      "",
      { children: ["(onboarding)", { children: ["clubs", { children: ["__PAGE__", {}] }] }] },
    ]),
  ),
};

/** Routing after login with 0, 1 and several clubs (SPEC §10.1–10.3, E15). */

test.describe("Flere klubber og routing", () => {
  test("lander i den senest åbnede klub, også efter klubskift, og i klubvælgeren når den er væk", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "flerklub");
    const first = clubName(testInfo, "Første");
    const second = clubName(testInfo, "Anden");
    const third = clubName(testInfo, "Tredje");

    const firstId = await signUpWithClub(page, user, first);
    const secondId = await createClub(page, second);
    const thirdId = await createClub(page, third);

    // The newest club is the active one (createClub remembers it).
    await logOut(page);
    await logIn(page, user);
    await expectOverview(page, thirdId);

    // Switch club with the ClubSwitcher (top bar on mobile, sidebar on desktop).
    await page.getByRole("button", { name: /Skift klub/ }).click();
    await expect(page.getByRole("menuitemradio", { name: third })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("menuitemradio", { name: first }).click();
    await expectOverview(page, firstId);
    await expect(page.getByRole("button", { name: /Skift klub/ })).toContainText(first);

    // The switch is remembered (lastActiveClubId, §10.3).
    await logOut(page);
    await logIn(page, user);
    await expectOverview(page, firstId);

    // E15: the last active club is gone → the club picker, without that club.
    await logOut(page);
    await deleteMembership(user.email, firstId);
    await logIn(page, user);
    await expect(page).toHaveURL(/\/clubs$/);
    await expect(page.getByRole("heading", { level: 1, name: "Vælg klub" })).toBeVisible();
    const picker = page.getByRole("main").getByRole("list");
    await expect(picker.getByRole("link")).toHaveCount(2);
    await expect(picker.getByRole("link", { name: new RegExp(second) })).toContainText(
      "Admin · 1 medlem",
    );
    await expect(picker.getByRole("link", { name: new RegExp(first) })).toHaveCount(0);

    // Picking a club opens it and makes it the active club again.
    await picker.getByRole("link", { name: new RegExp(second) }).click();
    await expectOverview(page, secondId);
    await logOut(page);
    await logIn(page, user);
    await expectOverview(page, secondId);
  });

  test("en bruger uden klubber sendes til onboarding efter login og kan logge ud derfra", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "klubloes");
    await signUp(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);

    // "/" and the club picker also lead to onboarding with 0 clubs.
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/clubs");
    await expect(page).toHaveURL(/\/onboarding$/);

    await expect(page.getByText(`Logget ind som ${user.email}`)).toBeVisible();
    await page.getByRole("button", { name: "Log ud" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await logIn(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Velkommen ombord! 🍺" }),
    ).toBeVisible();
  });

  test("en prefetch af en anden klub skifter ikke den aktive klub, et klik gør", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "prefetch");
    const firstId = await signUpWithClub(page, user, clubName(testInfo, "Aktiv"));
    const secondId = await createClub(page, clubName(testInfo, "Prefetchet"));

    // Make the first club the active one by opening it.
    await page.goto(`/c/${firstId}`);
    await expectOverview(page, firstId);
    await expect.poll(() => lastActiveClubId(user.email)).toBe(firstId);

    // A Link prefetch of the other club (renders its layout, not its page).
    const response = await page.request.get(`/c/${secondId}`, { headers: PREFETCH_FROM_CLUBS });
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/x-component");
    expect(await lastActiveClubId(user.email)).toBe(firstId);

    // Actually opening it from the picker does switch (§10.3).
    await page.goto("/clubs");
    await page
      .getByRole("main")
      .getByRole("link", { name: /Prefetchet/ })
      .click();
    await expectOverview(page, secondId);
    await expect.poll(() => lastActiveClubId(user.email)).toBe(secondId);
  });

  test("en bruger med én klub kan åbne onboarding fra Profil og komme tilbage", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "enklub");
    const name = clubName(testInfo, "Eneste");
    const clubId = await signUpWithClub(page, user, name);

    await profileLink(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mine klubber/ })).toHaveCount(0);
    await page.getByRole("link", { name: /Opret eller join ny klub/ }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Opret eller join en ny klub" }),
    ).toBeVisible();
    await page.getByRole("link", { name: `Tilbage til ${name}` }).click();
    await expectOverview(page, clubId);
  });
});
