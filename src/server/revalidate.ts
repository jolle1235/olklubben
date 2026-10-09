import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Revalidates everything under the club (`/c/[clubId]`, the layout and all
 * pages below it) after a write: events show up on Overblik, Kalender and the
 * beer pages, and beers and ratings on the catalogue, beer and event pages.
 *
 * Deliberately NOT in a "use server" file, where every export becomes a
 * callable Server Action.
 */
export function revalidateClub(clubId: string): void {
  revalidatePath(`/c/${clubId}`, "layout");
}

/**
 * Revalidates every page (the root layout and everything below it). For
 * changes the app shell shows on every page and in every club: the user's
 * name and nickname (sidebar, D-105), a club's name in the ClubSwitcher, and
 * the club list after leaving or deleting a club (D-104).
 */
export function revalidateAppShell(): void {
  revalidatePath("/", "layout");
}
