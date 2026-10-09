import { expect, test } from "./fixtures";
import { ageSession, latestSession } from "./support/db";
import { clubName, expectOverview, newUser, signUpWithClub } from "./support/app";

/**
 * Sliding sessions (D-030): 60 days, refreshed once a day while in use. The
 * refresh must happen where the cookie can be re-issued too, i.e. in the
 * get-session Route Handler, never in a Server Component render.
 */

const SESSION_TTL_SECONDS = 60 * 24 * 60 * 60;
const DAY_SECONDS = 24 * 60 * 60;

function isGetSession(url: string): boolean {
  return new URL(url).pathname === "/api/auth/get-session";
}

test.describe("Sessions", () => {
  test("en session i brug forlænges med både databaserækken og cookien", async ({
    page,
  }, testInfo) => {
    const user = newUser(testInfo, "session");
    const clubId = await signUpWithClub(page, user, clubName(testInfo, "Session"));

    // Pretend the last refresh was two days ago.
    const { id } = await latestSession(user.email);
    await ageSession(id);

    // A Server Component render cannot set cookies, so it must not move the
    // expiry either: a plain document request (no JavaScript) leaves the row alone.
    const document = await page.request.get(`/c/${clubId}`);
    expect(document.status()).toBe(200);
    expect((await latestSession(user.email)).updatedSecondsAgo).toBeGreaterThan(DAY_SECONDS);

    // In the browser the page asks the get-session Route Handler, which
    // refreshes the row AND re-issues the cookie for another 60 days.
    const refresh = page.waitForResponse((response) => isGetSession(response.url()));
    await page.reload();
    await expectOverview(page, clubId);
    const response = await refresh;
    expect(response.status()).toBe(200);
    expect((await response.allHeaders())["set-cookie"]).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    await expect
      .poll(async () => (await latestSession(user.email)).expiresInSeconds)
      .toBeGreaterThan(SESSION_TTL_SECONDS - 60);
    const refreshed = await latestSession(user.email);
    expect(refreshed.expiresInSeconds).toBeLessThanOrEqual(SESSION_TTL_SECONDS + 60);
    expect(refreshed.updatedSecondsAgo).toBeLessThan(60);

    // Refreshed today: the next page load makes no extra request.
    const getSessionCalls: string[] = [];
    page.on("request", (request) => {
      if (isGetSession(request.url())) getSessionCalls.push(request.url());
    });
    await page.reload();
    await expectOverview(page, clubId);
    await page.waitForLoadState("networkidle");
    expect(getSessionCalls).toEqual([]);
  });
});
