import "server-only";

import { compareByDisplayName } from "@/lib/format/display-name";
import { db } from "@/server/db";
import { isInviteActive } from "@/server/domain/clubs/invites";
import type { ClubRole } from "@/server/domain/clubs/permissions";
import { personSelect, type PersonRef } from "@/server/users/select";

/**
 * Read queries for clubs, members and invitations (SPEC §7, §9.8).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it. The
 * caller must already have checked membership with requireMembership(clubId),
 * except for findJoinableInvite(), which is the one lookup by code.
 */

export type ClubMember = {
  membershipId: string;
  userId: string;
  /** The official name; the list shows formatMemberName ("Kaptajnen (Jesper Thomsen)"). */
  name: string;
  nickname: string | null;
  image: string | null;
  role: ClubRole;
  joinedAt: Date;
};

/** All members of a club (unsorted; use sortMembers() for display). */
export async function getClubMembers(clubId: string): Promise<ClubMember[]> {
  const memberships = await db.membership.findMany({
    where: { clubId },
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, nickname: true, image: true } },
    },
  });
  return memberships.map(({ id, role, joinedAt, user }) => ({
    membershipId: id,
    userId: user.id,
    name: user.name,
    nickname: user.nickname,
    image: user.image,
    role,
    joinedAt,
  }));
}

/**
 * The club's members as people for pickers (the event form's hosts, D-098),
 * sorted by display name.
 */
export async function listMemberOptions(clubId: string): Promise<PersonRef[]> {
  const memberships = await db.membership.findMany({
    where: { clubId },
    select: { user: { select: personSelect } },
  });
  return memberships.map((membership) => membership.user).sort(compareByDisplayName);
}

/** How many members the club has. */
export async function countClubMembers(clubId: string): Promise<number> {
  return db.membership.count({ where: { clubId } });
}

/**
 * The club's current invitation code (canonical, e.g. "K7XMQ2PA"), or null if
 * it has none. Never findUnique({ where: { clubId } }): see the partial index
 * note in prisma/schema.prisma.
 */
export async function getActiveInviteCode(clubId: string): Promise<string | null> {
  const invite = await db.invite.findFirst({
    where: { clubId, revokedAt: null },
    select: { code: true, revokedAt: true, expiresAt: true },
  });
  return invite && isInviteActive(invite) ? invite.code : null;
}

export type JoinableInvite = {
  clubId: string;
  clubName: string;
  memberCount: number;
};

/**
 * The club behind an active invitation code, for the join confirmation (SPEC
 * §10.7). Null when the code does not exist, was revoked or has expired (E18).
 * `code` must be canonical (normalizeInviteCode / inviteCodeSchema).
 */
export async function findJoinableInvite(code: string): Promise<JoinableInvite | null> {
  const invite = await db.invite.findUnique({
    where: { code },
    select: {
      revokedAt: true,
      expiresAt: true,
      club: { select: { id: true, name: true, _count: { select: { memberships: true } } } },
    },
  });
  if (!invite || !isInviteActive(invite)) return null;
  return {
    clubId: invite.club.id,
    clubName: invite.club.name,
    memberCount: invite.club._count.memberships,
  };
}

/** True when the user is a member of the club. Always looked up by (userId, clubId). */
export async function isClubMember(userId: string, clubId: string): Promise<boolean> {
  const membership = await db.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
    select: { id: true },
  });
  return membership !== null;
}

/**
 * The user as a member of the club (person + role), or null when the user is
 * not a member. Always looked up by (userId, clubId). Show getDisplayName().
 */
export async function findClubMember(
  clubId: string,
  userId: string,
): Promise<(PersonRef & { role: ClubRole }) | null> {
  const membership = await db.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
    select: { role: true, user: { select: personSelect } },
  });
  return membership ? { ...membership.user, role: membership.role } : null;
}

/**
 * What "Slet klubben" deletes (§7.5, D-103): "14 events, 37 øl med 102
 * ratings og 5 steder". Members are counted, but their accounts stay.
 */
export async function getClubContentCounts(clubId: string): Promise<{
  members: number;
  events: number;
  beers: number;
  ratings: number;
  places: number;
}> {
  const [members, events, beers, ratings, places] = await Promise.all([
    db.membership.count({ where: { clubId } }),
    db.event.count({ where: { clubId } }),
    db.beer.count({ where: { clubId } }),
    db.beerRating.count({ where: { beer: { clubId } } }),
    db.place.count({ where: { clubId } }),
  ]);
  return { members, events, beers, ratings, places };
}

export type ResetLinkEligibility = {
  /** The target is in at least one club where the caller is not ADMIN (or not a member). */
  targetHasClubWhereCallerIsNotAdmin: boolean;
  /** The target has a non-password login, e.g. Google. */
  targetHasExternalLogin: boolean;
};

/**
 * Input for canResetMemberPassword() (SPEC §6.4): counts the target's clubs
 * that the caller does not administer, and the target's external logins.
 * Crosses club boundaries on purpose, but only returns two booleans; the
 * caller must never show which clubs or why (§3.3).
 */
export async function getResetLinkEligibility(
  callerUserId: string,
  targetUserId: string,
): Promise<ResetLinkEligibility> {
  const [foreignClubs, externalAccounts] = await Promise.all([
    db.membership.count({
      where: {
        userId: targetUserId,
        club: { memberships: { none: { userId: callerUserId, role: "ADMIN" } } },
      },
    }),
    db.account.count({ where: { userId: targetUserId, providerId: { not: "credential" } } }),
  ]);
  return {
    targetHasClubWhereCallerIsNotAdmin: foreignClubs > 0,
    targetHasExternalLogin: externalAccounts > 0,
  };
}
