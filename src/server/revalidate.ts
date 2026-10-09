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
