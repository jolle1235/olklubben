import type { PrismaClient } from "../../src/generated/prisma/client";

import { GuardError } from "./guard";

/**
 * Who imports into which club. The --user must exist and be ADMIN of the
 * club (§5.1: admins manage the songbook); otherwise exit 2.
 */

export type ImportUser = { id: string; email: string; name: string };
export type ImportClub = { id: string; name: string; members: number; songs: number };

export async function findImportUser(db: PrismaClient, email: string): Promise<ImportUser> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new GuardError(`Ingen bruger med emailen ${email}.`);
  return user;
}

/** The clubs where the user is ADMIN, with their song counts (for --user without --club). */
export async function listAdminClubs(db: PrismaClient, userId: string): Promise<ImportClub[]> {
  const memberships = await db.membership.findMany({
    where: { userId, role: "ADMIN" },
    select: {
      club: {
        select: { id: true, name: true, _count: { select: { memberships: true, songs: true } } },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  return memberships.map(({ club }) => ({
    id: club.id,
    name: club.name,
    members: club._count.memberships,
    songs: club._count.songs,
  }));
}

/** The target club; throws GuardError when it does not exist or the user is not its admin. */
export async function loadImportClub(
  db: PrismaClient,
  user: ImportUser,
  clubId: string,
): Promise<ImportClub> {
  const club = await db.club.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      name: true,
      _count: { select: { memberships: true, songs: true } },
      memberships: { where: { userId: user.id }, select: { role: true } },
    },
  });
  if (!club) throw new GuardError(`Ingen klub med id ${clubId}.`);
  if (club.memberships[0]?.role !== "ADMIN") {
    throw new GuardError(`${user.email} er ikke admin i ${club.name}.`);
  }
  return {
    id: club.id,
    name: club.name,
    members: club._count.memberships,
    songs: club._count.songs,
  };
}
