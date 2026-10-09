// Loads .env.local (or .env.test with NODE_ENV=test) like Next.js. Must stay first.
import "../scripts/load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient, type ClubRole } from "../src/generated/prisma/client";
import { pgConfig } from "../src/server/db/pg-config";
import { assertSeedTarget } from "../src/server/db/seed-target";
import {
  addDaysToDateKey,
  utcToZonedParts,
  zonedDateTimeToUtc,
} from "../src/server/domain/events/time";

/**
 * Test data for local development (SPEC §16.3 – round 1: users, clubs,
 * memberships, invitations; round 2: events, beers, ratings). Run with
 * `npm run db:seed`.
 *
 * Idempotent: running it again leaves the same rows. Users are matched by
 * email, clubs, events and beers by fixed id, memberships by (user, club),
 * invitations by code and ratings by (beer, user). The seed users' passwords
 * are reset to the documented one on every run.
 *
 * Event dates are RELATIVE to today (Europe/Copenhagen), so Overblik always
 * has a past tasting, one in 3 days and one in 4 weeks. Running the seed again
 * moves them to the new "today". Rows a developer created by hand are left
 * alone.
 *
 * Users log in with normal email + password: the hash comes from Better
 * Auth's own hasher, and the credential account looks exactly like the one
 * Better Auth creates on sign-up (providerId "credential", accountId = user id).
 *
 * The test users and passwords are listed in README.md ("Testbrugere").
 *
 * Refuses production and non-local databases before connecting
 * (src/server/db/seed-target.ts); SEED_ALLOW_REMOTE=1 allows a Neon dev branch.
 */

export const SEED_PASSWORD = "olklubben123";

const SEED_USERS = [
  {
    key: "jesper",
    id: "5eed0000-0000-7000-8000-0000000000a1",
    name: "Jesper",
    email: "jesper@example.com",
  },
  {
    key: "mads",
    id: "5eed0000-0000-7000-8000-0000000000a2",
    name: "Mads",
    email: "mads@example.com",
  },
  {
    key: "anders",
    id: "5eed0000-0000-7000-8000-0000000000a3",
    name: "Anders",
    email: "anders@example.com",
  },
] as const;

type SeedUserKey = (typeof SEED_USERS)[number]["key"];

const DRENGENE = "5eed0000-0000-7000-8000-0000000000c1";
const TORSDAG = "5eed0000-0000-7000-8000-0000000000c2";

const SEED_CLUBS: {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  members: { user: SeedUserKey; role: ClubRole }[];
}[] = [
  {
    id: DRENGENE,
    name: "Drengene & Bajere",
    description: "Ølsmagning hver anden fredag. Medbring godt humør og en ukendt øl.",
    inviteCode: "BAJER234",
    members: [
      { user: "jesper", role: "ADMIN" },
      { user: "mads", role: "MEMBER" },
      { user: "anders", role: "MEMBER" },
    ],
  },
  {
    id: TORSDAG,
    name: "Torsdagsklubben",
    description: "Én øl og én sang hver torsdag.",
    inviteCode: "TRSDAG78",
    members: [
      { user: "mads", role: "ADMIN" },
      { user: "jesper", role: "MEMBER" },
    ],
  },
];

// ─── Round 2: events, beers and ratings ─────────────────────────────────────

type SeedEvent = {
  id: string;
  clubId: string;
  createdBy: SeedUserKey;
  title: string;
  theme: string | null;
  description: string | null;
  locationText: string;
  /** Days from today (Copenhagen), and wall-clock times. */
  inDays: number;
  start: string;
  end: string | null;
};

const SEED_EVENTS: SeedEvent[] = [
  {
    id: "5eed0000-0000-7000-8000-0000000000e1",
    clubId: DRENGENE,
    createdBy: "mads",
    title: "Ølsmagning #12",
    theme: "Belgiske øl",
    description:
      "Vi starter med en let hvidtøl som opvarmning.\n\nDerefter tre belgiere fra mild til stærk – og pizza til dem, der kan holde til det.",
    locationText: "Hos Mads",
    inDays: -21,
    start: "18:30",
    end: "23:30",
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000e2",
    clubId: DRENGENE,
    createdBy: "jesper",
    title: "Ølsmagning #13",
    theme: "Tyske øl",
    description: "Medbring én tysk øl, gerne en I aldrig har smagt før.",
    locationText: "Hos Jesper",
    inDays: 3,
    start: "18:30",
    end: null,
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000e3",
    clubId: DRENGENE,
    createdBy: "anders",
    title: "Juleøl warmup",
    theme: "Juleøl",
    description: null,
    locationText: "Hos Anders",
    inDays: 28,
    start: "19:00",
    end: "23:00",
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000e4",
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Torsdagsøl",
    theme: null,
    description: null,
    locationText: "Bodegaen på hjørnet",
    inDays: 7,
    start: "19:30",
    end: null,
  },
];

type SeedBeer = {
  id: string;
  clubId: string;
  createdBy: SeedUserKey;
  name: string;
  abv: string;
  eventId: string | null;
  /** When it was added, in days from today (for "Nyeste"). */
  addedInDays: number;
  /** Stored values 2..10 (half points, D-003). */
  ratings: Partial<Record<SeedUserKey, number>>;
};

const SEED_BEERS: SeedBeer[] = [
  {
    id: "5eed0000-0000-7000-8000-0000000000b1",
    clubId: DRENGENE,
    createdBy: "mads",
    name: "Carlsberg Hvidtøl",
    abv: "1.9",
    eventId: "5eed0000-0000-7000-8000-0000000000e1",
    addedInDays: -21,
    ratings: { jesper: 5, mads: 6, anders: 3 },
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000b2",
    clubId: DRENGENE,
    createdBy: "mads",
    name: "Grimbergen Dubbel",
    abv: "6.5",
    eventId: "5eed0000-0000-7000-8000-0000000000e1",
    addedInDays: -21,
    ratings: { jesper: 9, mads: 10, anders: 9 },
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000b3",
    clubId: DRENGENE,
    createdBy: "jesper",
    name: "Westmalle Tripel",
    abv: "9.5",
    eventId: "5eed0000-0000-7000-8000-0000000000e1",
    addedInDays: -21,
    ratings: { jesper: 10, mads: 8, anders: 9 },
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000b4",
    clubId: DRENGENE,
    createdBy: "anders",
    name: "Duvel",
    abv: "8.5",
    eventId: "5eed0000-0000-7000-8000-0000000000e1",
    addedInDays: -21,
    ratings: { jesper: 8, mads: 9 },
  },
  {
    // No event: drunk at home and added afterwards.
    id: "5eed0000-0000-7000-8000-0000000000b5",
    clubId: DRENGENE,
    createdBy: "jesper",
    name: "Ørbæk Fynsk Forår",
    abv: "5.0",
    eventId: null,
    addedInDays: -10,
    ratings: { jesper: 7 },
  },
  {
    // No event and no ratings yet.
    id: "5eed0000-0000-7000-8000-0000000000b6",
    clubId: DRENGENE,
    createdBy: "anders",
    name: "Mikkeller Beer Geek Breakfast",
    abv: "7.5",
    eventId: null,
    addedInDays: -2,
    ratings: {},
  },
];

/** A Copenhagen date `days` from today at a wall-clock time, as a UTC instant. */
function relativeInstant(today: string, days: number, time: string): Date {
  const dateKey = addDaysToDateKey(today, days);
  const instant = dateKey ? zonedDateTimeToUtc(dateKey, time) : null;
  if (!instant) throw new Error(`Ugyldig seed-dato: ${today} + ${days} dage kl. ${time}`);
  return instant;
}

async function seedEventsAndBeers(
  db: PrismaClient,
  idOf: (key: SeedUserKey) => string,
): Promise<void> {
  const today = utcToZonedParts(new Date()).date;

  for (const event of SEED_EVENTS) {
    const startsAt = relativeInstant(today, event.inDays, event.start);
    // An end time before the start time ends the next day (overnight rule).
    const endsAt =
      event.end === null
        ? null
        : relativeInstant(
            today,
            event.end < event.start ? event.inDays + 1 : event.inDays,
            event.end,
          );
    const data = {
      title: event.title,
      theme: event.theme,
      description: event.description,
      locationText: event.locationText,
      startsAt,
      endsAt,
    };
    await db.event.upsert({
      where: { id: event.id },
      create: { id: event.id, clubId: event.clubId, createdById: idOf(event.createdBy), ...data },
      update: data,
    });
  }

  for (const beer of SEED_BEERS) {
    const createdAt = relativeInstant(today, beer.addedInDays, "20:00");
    const data = { name: beer.name, abv: beer.abv, eventId: beer.eventId, createdAt };
    await db.beer.upsert({
      where: { id: beer.id },
      create: { id: beer.id, clubId: beer.clubId, createdById: idOf(beer.createdBy), ...data },
      update: data,
    });
    for (const [user, value] of Object.entries(beer.ratings) as [SeedUserKey, number][]) {
      const userId = idOf(user);
      await db.beerRating.upsert({
        where: { beerId_userId: { beerId: beer.id, userId } },
        create: { beerId: beer.id, userId, value },
        update: { value },
      });
    }
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL mangler. Sæt den i .env.local (se .env.example).");
  }
  // Never production, and only a local database unless SEED_ALLOW_REMOTE=1.
  assertSeedTarget(connectionString);

  const db = new PrismaClient({ adapter: new PrismaPg(pgConfig(connectionString)) });
  try {
    const passwordHash = await hashPassword(SEED_PASSWORD);
    const userIds = new Map<SeedUserKey, string>();

    for (const seedUser of SEED_USERS) {
      const user = await db.user.upsert({
        where: { email: seedUser.email },
        create: {
          id: seedUser.id,
          name: seedUser.name,
          email: seedUser.email,
          emailVerified: false,
        },
        update: { name: seedUser.name },
        select: { id: true },
      });
      userIds.set(seedUser.key, user.id);

      await db.account.upsert({
        where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
        create: {
          userId: user.id,
          providerId: "credential",
          accountId: user.id,
          password: passwordHash,
        },
        update: { password: passwordHash },
      });
    }

    const idOf = (key: SeedUserKey): string => {
      const id = userIds.get(key);
      if (!id) throw new Error(`Seed-bruger mangler: ${key}`);
      return id;
    };

    for (const seedClub of SEED_CLUBS) {
      const firstAdmin = seedClub.members.find((member) => member.role === "ADMIN");
      if (!firstAdmin) throw new Error(`${seedClub.name} skal have mindst én admin (SPEC §5).`);

      await db.$transaction(async (tx) => {
        await tx.club.upsert({
          where: { id: seedClub.id },
          create: { id: seedClub.id, name: seedClub.name, description: seedClub.description },
          update: { name: seedClub.name, description: seedClub.description },
        });

        for (const member of seedClub.members) {
          const userId = idOf(member.user);
          await tx.membership.upsert({
            where: { userId_clubId: { userId, clubId: seedClub.id } },
            create: { userId, clubId: seedClub.id, role: member.role },
            update: { role: member.role },
          });
        }

        // One active invitation per club (partial unique index). Keep an active
        // code a developer generated by hand; otherwise (re)activate the seed code.
        const activeInvite = await tx.invite.findFirst({
          where: { clubId: seedClub.id, revokedAt: null },
          select: { id: true },
        });
        if (!activeInvite) {
          await tx.invite.upsert({
            where: { code: seedClub.inviteCode },
            create: {
              clubId: seedClub.id,
              code: seedClub.inviteCode,
              createdById: idOf(firstAdmin.user),
            },
            update: { revokedAt: null },
          });
        }
      });
    }

    await seedEventsAndBeers(db, idOf);

    // Jesper has two clubs and lands in his last active one; Mads has two and
    // gets the club picker; Anders has one and goes straight to it (SPEC §10.1).
    const jesperId = idOf("jesper");
    await db.user.updateMany({
      where: { id: jesperId, lastActiveClubId: null },
      data: { lastActiveClubId: SEED_CLUBS[0]?.id ?? null },
    });

    const [users, clubs, memberships, invites, events, beers, ratings] = await Promise.all([
      db.user.count(),
      db.club.count(),
      db.membership.count(),
      db.invite.count({ where: { revokedAt: null } }),
      db.event.count(),
      db.beer.count(),
      db.beerRating.count(),
    ]);
    console.info(
      `Seed færdig: ${users} brugere, ${clubs} klubber, ${memberships} medlemskaber, ${invites} aktive invitationer, ` +
        `${events} events, ${beers} øl, ${ratings} ratings.`,
    );
    console.info(
      `Log ind med ${SEED_USERS.map((user) => user.email).join(", ")} og password "${SEED_PASSWORD}".`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
