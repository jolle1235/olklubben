import { expect, type Locator, type Page } from "@playwright/test";

import { expectHydrated, memberRows, signUp, type TestUser } from "./app";
import { sql } from "./db";

/**
 * Steps for the club page's member administration and Profil (round 3,
 * SPEC §7.4, §7.5, §9.8; D-102–D-106), shared by members.spec.ts,
 * profile.spec.ts and password-reset.spec.ts.
 */

export type MemberAction =
  | "Gør til admin"
  | "Fjern admin-rollen"
  | "Fjern min admin-rolle"
  | "Lav nulstillingslink"
  | "Fjern fra klubben";

/** The member list's row for a member (matched on the shown name). */
export function memberRow(page: Page, name: string): Locator {
  return memberRows(page).filter({ hasText: name });
}

/** The '⋯' button an admin has on each member row. */
export function memberMenuButton(page: Page, name: string): Locator {
  return page.getByRole("button", { name: `Handlinger for ${name}`, exact: true });
}

/** Every '⋯' button on the page: none for a plain member. */
export function allMemberMenuButtons(page: Page): Locator {
  return page.getByRole("button", { name: /^Handlinger for / });
}

/** Opens a member's '⋯' menu (after hydration, F-039) and returns it. */
export async function openMemberMenu(page: Page, name: string): Promise<Locator> {
  const button = memberMenuButton(page, name);
  await expectHydrated(button);
  await button.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** '⋯' → a menu item. The item's dialog opens once the menu has closed. */
export async function chooseMemberAction(page: Page, name: string, action: MemberAction) {
  const menu = await openMemberMenu(page, name);
  await menu.getByRole("menuitem", { name: action, exact: true }).click();
  await expect(menu).toBeHidden();
}

/**
 * '⋯' → action → the confirmation's button (labelled like the menu item), and
 * waits for the dialog to close.
 */
export async function confirmMemberAction(
  page: Page,
  name: string,
  action: Exclude<MemberAction, "Lav nulstillingslink">,
  dialogTitle: string,
): Promise<void> {
  await chooseMemberAction(page, name, action);
  const dialog = page.getByRole("alertdialog", { name: dialogTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: action, exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** A new user joins the club through its invitation link, in their own browser context. */
export async function joinClub(page: Page, user: TestUser, invitePath: string, clubId: string) {
  await signUp(page, user, { next: invitePath });
  await page.getByRole("button", { name: "Join klub" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${clubId}$`));
}

/** The club page's "Farezone" section. */
export function dangerZone(page: Page): Locator {
  return page.getByRole("region", { name: "Farezone" });
}

/** Removes the user's password login, leaving Google only (a Google-only account, D-106). */
export async function makeGoogleOnly(email: string): Promise<void> {
  await sql(
    `DELETE FROM accounts WHERE provider_id = 'credential'
     AND user_id = (SELECT id FROM users WHERE email = $1)`,
    [email.toLowerCase()],
  );
}
