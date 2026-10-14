import { defaultHostIds } from "@/server/domain/events/hosts";

/**
 * The event a decided poll becomes (SPEC §9.7.7, D-007, D-009, D-131, E10,
 * E11).
 *
 *   * Title, theme and description are copied (the CHECKs are the same, so the
 *     copy can never fail); startsAt is the winning date, the place is the
 *     winning place, and there is no end time.
 *   * Event.createdById is always the poll's creator, also when an admin
 *     closed it or the creator has left.
 *   * Hosts: the winning place's owners who are members → else the creator if
 *     still a member (D-009) → else the acting user (the admin who closed or
 *     chose the winner, E11) → else nobody (an automatic close with the
 *     creator gone and no owners, E34).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export function eventFieldsFromPoll(
  poll: { title: string; theme: string | null; description: string | null; createdById: string },
  winner: { startsAt: Date; placeId: string },
): {
  title: string;
  theme: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: null;
  placeId: string;
  createdById: string;
} {
  return {
    title: poll.title,
    theme: poll.theme,
    description: poll.description,
    startsAt: winner.startsAt,
    endsAt: null,
    placeId: winner.placeId,
    createdById: poll.createdById,
  };
}

/** defaultHostIds({ ownerIds, fallbackUserIds: [creatorId, actorUserId?], memberIds }). */
export function pollEventHostIds(input: {
  ownerIds: readonly string[];
  creatorId: string;
  actorUserId: string | null;
  memberIds: ReadonlySet<string>;
}): string[] {
  const fallbackUserIds =
    input.actorUserId === null ? [input.creatorId] : [input.creatorId, input.actorUserId];
  return defaultHostIds({ ownerIds: input.ownerIds, fallbackUserIds, memberIds: input.memberIds });
}
