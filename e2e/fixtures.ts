import { test as base, type Page } from "@playwright/test";

/**
 * The E2E `test` with one extra fixture:
 *
 *   openPage() – a page in a NEW browser context (its own cookies), with the
 *   project's settings (baseURL, viewport, locale). For a second user in the
 *   same test, e.g. the friend who opens an invitation link. Closed after the test.
 */
export const test = base.extend<{ openPage: () => Promise<Page> }>({
  // The fixture callback is usually named `use`; renamed so the React hooks lint rule does not misfire.
  openPage: async ({ browser }, provide) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await provide(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from "@playwright/test";
