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
import { placeNameKey } from "../src/server/domain/places/name";

/**
 * Test data for local development (SPEC §16.3 – round 1: users, clubs,
 * memberships, invitations; round 2: events, beers, ratings; round 3:
 * nicknames, places with owners, hosts and past tastings for the history).
 * Run with `npm run db:seed`.
 *
 * Idempotent: running it again leaves the same rows. Users are matched by
 * email, clubs, events and beers by fixed id, memberships by (user, club),
 * invitations by code, ratings by (beer, user), places by fixed id or else by
 * their active name (D-097), owners and hosts by (place/event, user). The seed
 * users' names, nicknames and passwords are reset on every run.
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
    name: "Jesper Thomsen",
    // Shown instead of the name everywhere; the member list adds "(Jesper Thomsen)" (D-105).
    nickname: "Kaptajnen",
    email: "jesper@example.com",
  },
  {
    key: "mads",
    id: "5eed0000-0000-7000-8000-0000000000a2",
    name: "Mads",
    nickname: null,
    email: "mads@example.com",
  },
  {
    key: "anders",
    id: "5eed0000-0000-7000-8000-0000000000a3",
    name: "Anders",
    nickname: null,
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

// ─── Round 3: places ────────────────────────────────────────────────────────

type SeedPlace = {
  /** Fixed id for a fresh database. The round-3 migration may already have made the place with a random id (D-097). */
  id: string;
  clubId: string;
  createdBy: SeedUserKey;
  name: string;
  address: string | null;
  description: string | null;
  /** Members of the place's club (the composite FK refuses anyone else). */
  owners: SeedUserKey[];
  /** Archived this many days from today (negative), or null when active. */
  archivedInDays: number | null;
};

const HOS_MADS = "5eed0000-0000-7000-8000-0000000000f1";
const HOS_JESPER = "5eed0000-0000-7000-8000-0000000000f2";
const HOS_ANDERS = "5eed0000-0000-7000-8000-0000000000f3";
const BODEGAEN = "5eed0000-0000-7000-8000-0000000000f4";
const HOS_MADS_OG_ANDERS = "5eed0000-0000-7000-8000-0000000000f5";
const GAMLE_KLUBHUS = "5eed0000-0000-7000-8000-0000000000f6";
const LOKALE_BAR = "5eed0000-0000-7000-8000-0000000000f7";

// Every kind of place (SPEC §9.4): one owner, two owners, no owner, archived
// with an old tasting, and never used (so it may be deleted outright).
const SEED_PLACES: SeedPlace[] = [
  {
    id: HOS_MADS,
    clubId: DRENGENE,
    createdBy: "mads",
    name: "Hos Mads",
    address: "Søndergade 12, 8381 Tilst",
    description: "Ring på bagdøren",
    owners: ["mads"],
    archivedInDays: null,
  },
  {
    id: HOS_JESPER,
    clubId: DRENGENE,
    createdBy: "jesper",
    name: "Hos Jesper",
    address: null,
    description: null,
    owners: ["jesper"],
    archivedInDays: null,
  },
  {
    id: HOS_ANDERS,
    clubId: DRENGENE,
    createdBy: "anders",
    name: "Hos Anders",
    address: null,
    description: null,
    owners: ["anders"],
    archivedInDays: null,
  },
  {
    id: HOS_MADS_OG_ANDERS,
    clubId: DRENGENE,
    createdBy: "anders",
    name: "Hos Mads & Anders",
    address: "Bryggervej 7, 8381 Tilst",
    description: "Kollektivet. Begge bliver værter, når I vælger stedet.",
    owners: ["mads", "anders"],
    archivedInDays: null,
  },
  {
    id: GAMLE_KLUBHUS,
    clubId: DRENGENE,
    createdBy: "jesper",
    name: "Det gamle klubhus",
    address: null,
    description: "Revet ned i sommer. Vi savner det.",
    owners: [],
    archivedInDays: -40,
  },
  {
    id: LOKALE_BAR,
    clubId: DRENGENE,
    createdBy: "mads",
    name: "Den lokale bar",
    address: "Tilst Hovedgade 1, 8381 Tilst",
    description: null,
    owners: [],
    archivedInDays: null,
  },
  {
    id: BODEGAEN,
    clubId: TORSDAG,
    createdBy: "mads",
    name: "Bodegaen på hjørnet",
    address: null,
    description: null,
    owners: [],
    archivedInDays: null,
  },
];

/**
 * Upserts the seed places and returns seed id → actual id. A place is found by
 * its fixed id, else by its ACTIVE name in the club (the migration created the
 * round-2 places with random ids); that row is updated and keeps its id.
 * Otherwise it is created with the fixed id. Owners are set to the seed's list.
 */
async function seedPlaces(
  db: PrismaClient,
  idOf: (key: SeedUserKey) => string,
  today: string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const place of SEED_PLACES) {
    const nameKey = placeNameKey(place.name);
    const existing =
      (await db.place.findFirst({
        where: { id: place.id, clubId: place.clubId },
        select: { id: true },
      })) ??
      // Never findUnique on (clubId, nameKey): the unique index is partial (D-095).
      (await db.place.findFirst({
        where: { clubId: place.clubId, nameKey, archivedAt: null },
        select: { id: true },
      }));
    const data = {
      name: place.name,
      nameKey,
      address: place.address,
      description: place.description,
      archivedAt:
        place.archivedInDays === null
          ? null
          : relativeInstant(today, place.archivedInDays, "12:00"),
    };
    const id = existing
      ? (await db.place.update({ where: { id: existing.id }, data, select: { id: true } })).id
      : (
          await db.place.create({
            data: {
              id: place.id,
              clubId: place.clubId,
              createdById: idOf(place.createdBy),
              ...data,
            },
            select: { id: true },
          })
        ).id;
    ids.set(place.id, id);

    const ownerIds = place.owners.map(idOf);
    await db.placeOwner.deleteMany({ where: { placeId: id, userId: { notIn: ownerIds } } });
    await db.placeOwner.createMany({
      data: ownerIds.map((userId) => ({ placeId: id, clubId: place.clubId, userId })),
      skipDuplicates: true,
    });
  }
  return ids;
}

// ─── Round 2 (+ round 3 history): events, beers and ratings ─────────────────

type SeedEvent = {
  id: string;
  clubId: string;
  createdBy: SeedUserKey;
  title: string;
  theme: string | null;
  description: string | null;
  /** A SEED_PLACES id (round 3). */
  placeId: string;
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
    placeId: HOS_MADS,
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
    placeId: HOS_JESPER,
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
    placeId: HOS_ANDERS,
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
    placeId: BODEGAEN,
    inDays: 7,
    start: "19:30",
    end: null,
  },
  // Round 3: older tastings for the history (D-107). Two hosts (the place's owners) …
  {
    id: "5eed0000-0000-7000-8000-0000000000e5",
    clubId: DRENGENE,
    createdBy: "anders",
    title: "Ølsmagning #11",
    theme: "IPA",
    description: "Humle, humle og mere humle.",
    placeId: HOS_MADS_OG_ANDERS,
    inDays: -35,
    start: "19:00",
    end: "23:30",
  },
  // … and one at a place that has since been archived, without beers.
  {
    id: "5eed0000-0000-7000-8000-0000000000e6",
    clubId: DRENGENE,
    createdBy: "jesper",
    title: "Ølsmagning #10",
    theme: "Afsked med klubhuset",
    description: null,
    placeId: GAMLE_KLUBHUS,
    inDays: -49,
    start: "18:30",
    end: "01:00",
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
  // Round 3: Ølsmagning #11 (IPA) for the history.
  {
    id: "5eed0000-0000-7000-8000-0000000000b7",
    clubId: DRENGENE,
    createdBy: "anders",
    name: "BrewDog Punk IPA",
    abv: "5.4",
    eventId: "5eed0000-0000-7000-8000-0000000000e5",
    addedInDays: -35,
    ratings: { jesper: 7, mads: 6, anders: 8 },
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000b8",
    clubId: DRENGENE,
    createdBy: "mads",
    name: "Sierra Nevada Pale Ale",
    abv: "5.6",
    eventId: "5eed0000-0000-7000-8000-0000000000e5",
    addedInDays: -35,
    ratings: { jesper: 8, mads: 9, anders: 7 },
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000b9",
    clubId: DRENGENE,
    createdBy: "jesper",
    name: "Amager Bryghus Todd the Axe Man",
    abv: "6.5",
    eventId: "5eed0000-0000-7000-8000-0000000000e5",
    addedInDays: -35,
    ratings: { jesper: 9, anders: 9 },
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
  const placeIds = await seedPlaces(db, idOf, today);

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
    const placeId = placeIds.get(event.placeId);
    if (!placeId) throw new Error(`Seed-sted mangler: ${event.placeId}`);
    const data = {
      title: event.title,
      theme: event.theme,
      description: event.description,
      placeId,
      startsAt,
      endsAt,
    };
    await db.event.upsert({
      where: { id: event.id },
      create: { id: event.id, clubId: event.clubId, createdById: idOf(event.createdBy), ...data },
      update: data,
    });

    // Hosts (D-098): the place's owners, else the creator.
    const owners = SEED_PLACES.find((place) => place.id === event.placeId)?.owners ?? [];
    const hostIds = (owners.length > 0 ? owners : [event.createdBy]).map(idOf);
    await db.eventHost.deleteMany({ where: { eventId: event.id, userId: { notIn: hostIds } } });
    await db.eventHost.createMany({
      data: hostIds.map((userId) => ({ eventId: event.id, userId })),
      skipDuplicates: true,
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
          nickname: seedUser.nickname,
          email: seedUser.email,
          emailVerified: false,
        },
        update: { name: seedUser.name, nickname: seedUser.nickname },
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

    const [users, clubs, memberships, invites, places, owners, events, hosts, beers, ratings] =
      await Promise.all([
        db.user.count(),
        db.club.count(),
        db.membership.count(),
        db.invite.count({ where: { revokedAt: null } }),
        db.place.count(),
        db.placeOwner.count(),
        db.event.count(),
        db.eventHost.count(),
        db.beer.count(),
        db.beerRating.count(),
      ]);
    console.info(
      `Seed færdig: ${users} brugere, ${clubs} klubber, ${memberships} medlemskaber, ${invites} aktive invitationer, ` +
        `${places} steder (${owners} ejerskaber), ${events} events (${hosts} værtskaber), ${beers} øl, ${ratings} ratings.`,
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
