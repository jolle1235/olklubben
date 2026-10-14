import "server-only";

import { notFound } from "next/navigation";

import { isValidId } from "@/lib/ids";
import {
  rememberActiveClub,
  requireMembership,
  type ClubInfo,
  type MembershipInfo,
  type SessionUser,
} from "@/server/auth/session";

import { getPollRef, type PollRef } from "./queries";

/**
 * Access to one poll for its pages and actions (SPEC §4.4, D-052, D-065,
 * D-066), like src/server/events/access.ts:
 *
 *   requirePoll(clubId, pollId)     membership + the poll in THIS club, else
 *                                   notFound(). Never writes, so it is safe in
 *                                   the guard layout (polls/[pollId]/layout.tsx).
 *   requirePollPage(clubId, pollId) the same, then remembers the active club.
 *
 * Unknown, malformed and other-club ids all give a real 404 (E22), before the
 * active club changes. The edit page calls requirePoll → canEditPoll →
 * rememberActiveClub (D-089). `poll` is the cached PollRef: it may be stale
 * after a lazy close in the same request (getPollView decides what renders).
 */

export type PollAccess = {
  user: SessionUser;
  membership: MembershipInfo;
  club: ClubInfo;
  poll: PollRef;
};

export async function requirePoll(clubId: string, pollId: string): Promise<PollAccess> {
  const access = await requireMembership(clubId);
  if (!isValidId(pollId)) notFound();
  const poll = await getPollRef(access.club.id, pollId);
  if (!poll) notFound();
  return { ...access, poll };
}

export async function requirePollPage(clubId: string, pollId: string): Promise<PollAccess> {
  const access = await requirePoll(clubId, pollId);
  await rememberActiveClub(access.user, access.club.id);
  return access;
}
