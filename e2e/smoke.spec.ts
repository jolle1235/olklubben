import { expect, test } from "@playwright/test";

test("serveren og Better Auth svarer", async ({ request }) => {
  const response = await request.get("/api/auth/ok");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("en logget-ud bruger sendes fra forsiden til login", async ({ page }) => {
  // src/proxy.ts redirects "/" without a session cookie to /login (no ?next=).
  // Whether /login itself renders is covered by the auth flow tests.
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle(/Ølklubben/);
});

test("et dybt link husker siden gennem login", async ({ page }) => {
  await page.goto("/clubs?fra=test");

  const url = new URL(page.url());
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("next")).toBe("/clubs?fra=test");
});
