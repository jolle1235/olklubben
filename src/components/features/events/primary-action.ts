import type { EventTiming } from "@/server/domain/events/status";

/**
 * The event page's one primary action (SPEC §13.4.5), shown highlighted in
 * the page and as the mobile top bar action:
 *
 *   * Before the start, for the creator, a host or an admin: "Rediger". Until the
 *     tasting, fixing the time, place or plan is what they come for.
 *   * Otherwise "Tilføj øl": from the start and afterwards the beers are
 *     what matters (§10.5), and members who may not edit have nothing else
 *     to do on the page.
 *
 * Pure and client-safe.
 */
export type EventPrimaryAction = "edit" | "addBeer";

export function eventPrimaryAction(
  event: Pick<EventTiming, "startsAt">,
  now: Date,
  canEdit: boolean,
): EventPrimaryAction {
  return canEdit && now.getTime() < event.startsAt.getTime() ? "edit" : "addBeer";
}
