import "server-only";

import { db } from "@/server/db";
import { generateInviteCode } from "@/server/domain/clubs/invite-code";
import { isInviteActive } from "@/server/domain/clubs/invites";

import { retryOnUniqueViolation } from "./unique-retry";

/**
 * Writes for clubs, memberships and invitations (SPEC §5, §7.1–7.3).
 *
 * Authorization is the caller's job (the Server Actions in
 * src/server/actions/clubs.ts): these functions trust their arguments.
 */

/**
 * Creates a club with the creator as its first Admin (D-018, D-021) and its
 * first invitation code, and makes it the creator's active club – all in one
 * transaction. A code collision retries the whole transaction with a new code.
 */
export async function createClubWithAdmin(input: {
  userId: string;
  name: string;
}): Promise<{ clubId: string }> {
  const { userId, name } = input;
  return retryOnUniqueViolation(() =>
    db.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name,
          memberships: { create: { userId, role: "ADMIN" } },
          invites: { create: { code: generateInviteCode(), createdById: userId } },
        },
        select: { id: true },
      });
      await tx.user.update({ where: { id: userId }, data: { lastActiveClubId: club.id } });
      return { clubId: club.id };
    }),
  );
}

export type JoinResult =
  | { status: "joined"; clubId: string }
  | { status: "already-member"; clubId: string }
  | { status: "invalid-code" };

/**
 * Joins the club behind an active invitation code as MEMBER and makes it the
 * user's active club (SPEC §7.2, §10.7). The club comes from the code on the
 * server, never from the client.
 *
 * Idempotent: an existing membership (also an admin's) is left untouched and
 * reported as "already-member" (E17). INSERT … ON CONFLICT DO NOTHING means a
 * double tap or two tabs can never fail on the unique (user_id, club_id).
 */
export async function joinClubWithInviteCode(input: {
  userId: string;
  code: string;
}): Promise<JoinResult> {
  const { userId, code } = input;
  return db.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({
      where: { code },
      select: { clubId: true, revokedAt: true, expiresAt: true },
    });
    if (!invite || !isInviteActive(invite)) return { status: "invalid-code" };

    const { count } = await tx.membership.createMany({
      data: [{ userId, clubId: invite.clubId, role: "MEMBER" }],
      skipDuplicates: true,
    });
    await tx.user.update({ where: { id: userId }, data: { lastActiveClubId: invite.clubId } });

    return { status: count === 1 ? "joined" : "already-member", clubId: invite.clubId };
  });
}

/**
 * Replaces the club's invitation code (SPEC §7.3): the active code is revoked
 * (the old code and link stop working) and a new one is created, in one
 * transaction. Retries on a code collision and on a concurrent regenerate.
 */
export async function regenerateClubInvite(input: {
  clubId: string;
  createdById: string;
}): Promise<{ code: string }> {
  const { clubId, createdById } = input;
  return retryOnUniqueViolation(() =>
    db.$transaction(async (tx) => {
      await tx.invite.updateMany({
        where: { clubId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invite = await tx.invite.create({
        data: { clubId, code: generateInviteCode(), createdById },
        select: { code: true },
      });
      return { code: invite.code };
    }),
  );
}
