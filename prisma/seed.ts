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
import { cleanSongText } from "../src/server/domain/songs/song-text";
import { cleanSongTitle, songTitleKey } from "../src/server/domain/songs/title";

/**
 * Test data for local development (SPEC §16.3 – round 1: users, clubs,
 * memberships, invitations; round 2: events, beers, ratings; round 3:
 * nicknames, places with owners, hosts and past tastings for the history,
 * and five SYNTHETIC songs in Torsdagsklubben – never real lyrics; round 4:
 * polls). Run with `npm run db:seed`.
 *
 * Idempotent: running it again leaves the same rows. Users are matched by
 * email, clubs, events and beers by fixed id, memberships by (user, club),
 * invitations by code, ratings by (beer, user), places by fixed id or else by
 * their active name (D-097), owners and hosts by (place/event, user), songs by
 * fixed id or else by their title key (only in Torsdagsklubben, so the
 * songbook imported into Drengene & Bajere is never touched). The seed users'
 * names, nicknames and passwords are reset on every run.
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
 * Polls (round 4, fixed ids …01a1–…01a3): Drengene & Bajere has an OPEN
 * poll where Mads and Anders have voted and Jesper has not ("Du mangler at
 * stemme"), and a CLOSED poll that created "Ølsmagning #13" ("Valgt ved
 * afstemning 🗳"); Torsdagsklubben has an AWAITING_DECISION poll with a tie
 * about the place, which Mads (admin) can resolve. Poll rows are created once
 * and never overwritten: a poll that is no longer in its seeded state (closed
 * or resolved by hand, or its dates and places edited, D-153) is left alone.
 * The OPEN poll's deadline is fixed at its first seed, so after ~10 days it
 * closes lazily into an event on the next Overblik/Kalender/poll view –
 * expected in dev. Delete the poll rows (or run against a fresh database) to
 * get it back.
 *
 * Feedback (§9.9, fixed ids …02f1–…02f4): four fictional reports, one per
 * kind – a NEW bug with a page and technical info, a PLANNED wish with an
 * answer, a DONE wish and a DUPLICATE bug pointing at the first – plus a few
 * 👍 (never on the author's own report). Created once, never overwritten.
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
const MADS_KAELDER = "5eed0000-0000-7000-8000-0000000000f8";

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
  // Round 4: Torsdagsklubben's second place, for the tied poll.
  {
    id: MADS_KAELDER,
    clubId: TORSDAG,
    createdBy: "mads",
    name: "Mads' kælder",
    address: null,
    description: "Trappen ned ved siden af cykelkælderen.",
    owners: ["mads"],
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
): Promise<Map<string, string>> {
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
  return placeIds;
}

// ─── Round 4: polls ─────────────────────────────────────────────────────────

const POLL_OPEN = "5eed0000-0000-7000-8000-0000000001a1";
const POLL_TIE = "5eed0000-0000-7000-8000-0000000001a2";
const POLL_DONE = "5eed0000-0000-7000-8000-0000000001a3";
/** The seeded event the CLOSED poll created ("Ølsmagning #13"). */
const POLL_DONE_EVENT = "5eed0000-0000-7000-8000-0000000000e2";

const pollId = (n: number) =>
  `5eed0000-0000-7000-8000-0000000001${n.toString(16).padStart(2, "0")}`;

type SeedPollOption =
  | { id: string; kind: "date"; inDays: number; start: string }
  | { id: string; kind: "place"; placeId: string };

type SeedPoll = {
  id: string;
  clubId: string;
  createdBy: SeedUserKey;
  title: string;
  theme: string | null;
  description: string | null;
  deadline: { inDays: number; time: string };
  /** The state the seed creates; a poll found in any other state is left alone. */
  status: "OPEN" | "AWAITING_DECISION" | "CLOSED";
  close: { reason: "DEADLINE" | "ALL_VOTED"; inDays: number; time: string } | null;
  options: SeedPollOption[];
  ballots: { id: string; user: SeedUserKey; noDateWorks?: boolean; optionIds: string[] }[];
  /** CLOSED: the seeded event it created (its date and place are the winners). */
  eventId?: string;
};

const SEED_POLLS: SeedPoll[] = [
  {
    // Drengene & Bajere: open, Mads and Anders have voted, Jesper has not.
    id: POLL_OPEN,
    clubId: DRENGENE,
    createdBy: "mads",
    title: "Ølsmagning #14",
    theme: "Juleøl",
    description: "Vi stemmer om, hvornår og hvor juleøllene skal smages.\nTag gerne en med.",
    deadline: { inDays: 10, time: "20:00" },
    status: "OPEN",
    close: null,
    options: [
      { id: pollId(0xb1), kind: "date", inDays: 14, start: "18:30" },
      { id: pollId(0xb2), kind: "date", inDays: 21, start: "18:30" },
      { id: pollId(0xb3), kind: "date", inDays: 28, start: "18:30" },
      { id: pollId(0xb4), kind: "place", placeId: HOS_MADS },
      { id: pollId(0xb5), kind: "place", placeId: HOS_JESPER },
      { id: pollId(0xb6), kind: "place", placeId: HOS_ANDERS },
    ],
    ballots: [
      { id: pollId(0xd1), user: "mads", optionIds: [pollId(0xb2), pollId(0xb3), pollId(0xb4)] },
      { id: pollId(0xd2), user: "anders", noDateWorks: true, optionIds: [pollId(0xb5)] },
    ],
  },
  {
    // Torsdagsklubben: the deadline passed with a tie about the place; Mads (admin) chooses.
    id: POLL_TIE,
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Juletorsdag",
    theme: null,
    description: null,
    deadline: { inDays: -1, time: "20:00" },
    status: "AWAITING_DECISION",
    close: { reason: "DEADLINE", inDays: -1, time: "20:00" },
    options: [
      { id: pollId(0xb7), kind: "date", inDays: 20, start: "19:30" },
      { id: pollId(0xb8), kind: "date", inDays: 27, start: "19:30" },
      { id: pollId(0xb9), kind: "place", placeId: BODEGAEN },
      { id: pollId(0xba), kind: "place", placeId: MADS_KAELDER },
    ],
    ballots: [
      { id: pollId(0xd3), user: "mads", optionIds: [pollId(0xb7), pollId(0xb9)] },
      { id: pollId(0xd4), user: "jesper", optionIds: [pollId(0xb7), pollId(0xba)] },
    ],
  },
  {
    // Drengene & Bajere: everyone voted, and the poll created "Ølsmagning #13".
    id: POLL_DONE,
    clubId: DRENGENE,
    createdBy: "jesper",
    title: "Ølsmagning #13",
    theme: "Tyske øl",
    description: "Medbring én tysk øl, gerne en I aldrig har smagt før.",
    deadline: { inDays: 1, time: "20:00" },
    status: "CLOSED",
    close: { reason: "ALL_VOTED", inDays: -1, time: "21:15" },
    options: [
      // The first date and place are the event's (SEED_EVENTS e2: in 3 days, Hos Jesper).
      { id: pollId(0xbb), kind: "date", inDays: 3, start: "18:30" },
      { id: pollId(0xbc), kind: "date", inDays: 10, start: "18:30" },
      { id: pollId(0xbd), kind: "place", placeId: HOS_JESPER },
      { id: pollId(0xbe), kind: "place", placeId: HOS_MADS },
    ],
    ballots: [
      { id: pollId(0xd5), user: "jesper", optionIds: [pollId(0xbb), pollId(0xbd)] },
      { id: pollId(0xd6), user: "mads", optionIds: [pollId(0xbb), pollId(0xbc), pollId(0xbe)] },
      { id: pollId(0xd7), user: "anders", optionIds: [pollId(0xbb), pollId(0xbd)] },
    ],
    eventId: POLL_DONE_EVENT,
  },
];

/**
 * Creates the seed polls once (fixed ids). A poll still in its seeded state
 * gets its ballots (and, for the CLOSED one, its options – their dates follow
 * the re-seeded event) written again; a poll the developer has changed since
 * is left alone. Lifecycle columns satisfy the CHECKs (polls_lifecycle_*).
 */
async function seedPolls(
  db: PrismaClient,
  idOf: (key: SeedUserKey) => string,
  placeIds: Map<string, string>,
): Promise<void> {
  const today = utcToZonedParts(new Date()).date;
  for (const poll of SEED_POLLS) {
    const close = poll.close;
    const existing = await db.poll.findFirst({
      where: { id: poll.id, clubId: poll.clubId },
      select: { status: true },
    });
    if (existing && existing.status !== poll.status) continue;
    if (existing && poll.status !== "CLOSED") {
      // Dates and places edited since (D-153: possible while nobody has voted).
      const stored = await db.pollOption.findMany({
        where: { pollId: poll.id },
        select: { id: true },
      });
      const seeded = new Set(poll.options.map((option) => option.id));
      const same = stored.length === seeded.size && stored.every((option) => seeded.has(option.id));
      if (!same) continue;
    }
    if (!existing) {
      await db.poll.create({
        data: {
          id: poll.id,
          clubId: poll.clubId,
          createdById: idOf(poll.createdBy),
          title: poll.title,
          theme: poll.theme,
          description: poll.description,
          deadline: relativeInstant(today, poll.deadline.inDays, poll.deadline.time),
          status: poll.status,
          closeReason: close?.reason ?? null,
          closedAt: close ? relativeInstant(today, close.inDays, close.time) : null,
        },
      });
    }

    const optionRows = poll.options.map((option) => {
      if (option.kind === "date") {
        return {
          id: option.id,
          pollId: poll.id,
          clubId: poll.clubId,
          category: "DATE" as const,
          startsAt: relativeInstant(today, option.inDays, option.start),
        };
      }
      const placeId = placeIds.get(option.placeId);
      if (!placeId) throw new Error(`Seed-sted mangler: ${option.placeId}`);
      return {
        id: option.id,
        pollId: poll.id,
        clubId: poll.clubId,
        category: "PLACE" as const,
        placeId,
      };
    });

    // Ballots (and their votes, by cascade) are written again each run.
    await db.pollBallot.deleteMany({
      where: { pollId: poll.id, id: { in: poll.ballots.map((ballot) => ballot.id) } },
    });
    if (poll.status === "CLOSED") {
      // Its dates follow the re-seeded event: recreate the options (votes cascade).
      await db.pollOption.deleteMany({ where: { pollId: poll.id } });
      await db.pollOption.createMany({ data: optionRows });
    } else {
      // A new poll gets its options; an existing one has exactly these already (above).
      await db.pollOption.createMany({ data: optionRows, skipDuplicates: true });
    }

    const categoryOf = new Map(optionRows.map((option) => [option.id, option.category]));
    for (const ballot of poll.ballots) {
      await db.pollBallot.create({
        data: {
          id: ballot.id,
          pollId: poll.id,
          userId: idOf(ballot.user),
          noDateWorks: ballot.noDateWorks ?? false,
          votes: {
            createMany: {
              data: ballot.optionIds.map((optionId) => {
                const category = categoryOf.get(optionId);
                if (!category) throw new Error(`Seed-valgmulighed mangler: ${optionId}`);
                return { optionId, category };
              }),
            },
          },
        },
      });
    }

    if (poll.eventId) {
      // The event it created (§9.7.7); same club (composite FK), unique per poll.
      await db.event.updateMany({
        where: { id: poll.eventId, clubId: poll.clubId },
        data: { pollId: poll.id },
      });
    }
  }
}

// ─── Feedback (SPEC §9.9) ───────────────────────────────────────────────────

const FEEDBACK_CALENDAR_BUG = "5eed0000-0000-7000-8000-0000000002f1";
const FEEDBACK_DARK_THEME = "5eed0000-0000-7000-8000-0000000002f2";
const FEEDBACK_SONGBOOK = "5eed0000-0000-7000-8000-0000000002f3";
const FEEDBACK_CALENDAR_DUPLICATE = "5eed0000-0000-7000-8000-0000000002f4";

type SeedFeedback = {
  id: string;
  type: "BUG" | "FEATURE";
  status: "NEW" | "PLANNED" | "DONE" | "DUPLICATE";
  createdBy: SeedUserKey;
  title: string;
  description: string;
  pagePath?: string;
  userAgent?: string;
  viewportWidth?: number;
  adminResponse?: string;
  duplicateOfId?: string;
  /** Created this many days ago (first seed only). */
  daysAgo: number;
  /** 👍 from these users (never the author: they already count as 1). */
  voters: SeedUserKey[];
};

// Fictional reports: one of each kind the list and the detail page show.
const SEED_FEEDBACK: SeedFeedback[] = [
  {
    id: FEEDBACK_CALENDAR_BUG,
    type: "BUG",
    status: "NEW",
    createdBy: "mads",
    title: "Kalenderen viser forkert dato på mobil",
    description:
      "Når jeg trykker på en fredag i månedsvisningen, åbner den lørdagen i stedet.\n" +
      "Det sker kun på telefonen, ikke på computeren.",
    pagePath: "/calendar",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewportWidth: 390,
    daysAgo: 2,
    voters: ["jesper", "anders"],
  },
  {
    id: FEEDBACK_DARK_THEME,
    type: "FEATURE",
    status: "PLANNED",
    createdBy: "anders",
    title: "Mørkt tema",
    description: "Et mørkt tema til de sene smagninger, så skærmen ikke blænder hele bordet.",
    adminResponse: "Giver mening – planlagt efter afstemningerne.",
    daysAgo: 9,
    voters: ["mads"],
  },
  {
    id: FEEDBACK_SONGBOOK,
    type: "FEATURE",
    status: "DONE",
    createdBy: "jesper",
    title: "Sangbogen i appen",
    description: "Vi vil gerne kunne finde sangene på telefonen i stedet for at bladre i PDF'er.",
    adminResponse: "Færdig – Sangbog ligger i menuen.",
    daysAgo: 21,
    voters: [],
  },
  {
    id: FEEDBACK_CALENDAR_DUPLICATE,
    type: "BUG",
    status: "DUPLICATE",
    createdBy: "anders",
    title: "Forkert dag i kalenderen",
    description: "Kalenderen åbner dagen efter den, jeg trykker på.",
    pagePath: "/calendar",
    adminResponse: "Samme fejl som den første rapport om kalenderen.",
    duplicateOfId: FEEDBACK_CALENDAR_BUG,
    daysAgo: 1,
    voters: [],
  },
];

/**
 * Creates the seed reports and their 👍 once (fixed ids, create-only): a
 * report changed in the app (status, answer, text) is never overwritten. A
 * deleted one is created again; the duplicate only points at the original
 * while it exists (duplicate_of_id is SET NULL otherwise).
 */
async function seedFeedback(db: PrismaClient, idOf: (key: SeedUserKey) => string): Promise<void> {
  const now = Date.now();
  for (const report of SEED_FEEDBACK) {
    const isBug = report.type === "BUG";
    const duplicateOfId =
      report.duplicateOfId &&
      (await db.feedback.findUnique({ where: { id: report.duplicateOfId }, select: { id: true } }))
        ? report.duplicateOfId
        : null;
    await db.feedback.upsert({
      where: { id: report.id },
      create: {
        id: report.id,
        type: report.type,
        status: report.status,
        title: report.title,
        description: report.description,
        pagePath: isBug ? (report.pagePath ?? null) : null,
        userAgent: isBug ? (report.userAgent ?? null) : null,
        viewportWidth: isBug ? (report.viewportWidth ?? null) : null,
        adminResponse: report.adminResponse ?? null,
        duplicateOfId: report.status === "DUPLICATE" ? duplicateOfId : null,
        createdById: idOf(report.createdBy),
        createdAt: new Date(now - report.daysAgo * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
    const voters = report.voters.filter((voter) => voter !== report.createdBy);
    if (voters.length > 0) {
      await db.feedbackVote.createMany({
        data: voters.map((voter) => ({ feedbackId: report.id, userId: idOf(voter) })),
        skipDuplicates: true,
      });
    }
  }
}

// ─── Round 3: the songbook ──────────────────────────────────────────────────

type SeedSong = {
  id: string;
  clubId: string;
  createdBy: SeedUserKey;
  title: string;
  artist: string | null;
  melody: string | null;
  /** The song-text format (src/server/domain/songs/song-text.ts). */
  body: string;
};

// SYNTHETIC songs only, written for the seed: never a real song's title or
// lyrics (the club's own songbook is imported locally by
// scripts/import-songbook.ts, SPEC §19.1). They go in Torsdagsklubben, so
// "Drengene & Bajere" holds exactly the imported songbook. Together they show
// every part of the format: a capo note, an instrumental intro, a chord
// sequence, chords positioned over words, [Omkvæd] repeated, a song without
// chords, one filed under Æ, one under Å ("Aa…") and one with only a melody.
const SEED_SONGS: SeedSong[] = [
  {
    id: "5eed0000-0000-7000-8000-0000000000d1",
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Skål for kaptajnen",
    artist: "Havnens Drenge",
    melody: null,
    body: [
      "capo: 2",
      "",
      "[Intro]",
      "G C D x2",
      "",
      "G          C",
      "Vi sejler ud ved daggry",
      "D             G",
      "med tønder fulde af øl",
      "Em C D G",
      "Kaptajnen står ved roret",
      "og synger hele vejen hjem",
      "",
      "[Omkvæd]",
      "C       G",
      "Skål for kaptajnen,",
      "D           G",
      "skål for hver en mand",
      "C       G",
      "Skål for kaptajnen,",
      "      D            G",
      "til vi atter ser land",
      "",
      "Em C D G",
      "Når stormen tager sejlene",
      "og bølgen slår mod stævn",
      "så finder vi en tønde mere",
      "og drikker med vores navn",
      "",
      "[Omkvæd]",
      "C       G",
      "Skål for kaptajnen,",
      "D           G",
      "skål for hver en mand",
      "C       G",
      "Skål for kaptajnen,",
      "      D            G",
      "til vi atter ser land",
    ].join("\n"),
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000d2",
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Sangen om den sidste tønde",
    artist: "Bryggeriets Kor",
    melody: null,
    body: [
      "[Vers 1]",
      "Am F C G",
      "Den sidste tønde står i hjørnet",
      "vi gemmer den til sidst",
      "for når den er drukket",
      "så er det slut, helt vist",
      "",
      "[Omkvæd]",
      "C G Am F",
      "Hej, hej, den sidste tønde",
      "den drikker vi i nat",
      "",
      "[Vers 2]",
      "Am F C G",
      "Vi tæller dråberne i glasset",
      "og synger lidt for højt",
      "så kommer værten ind og siger",
      "at nu er det vist nok",
      "",
      "[Omkvæd]",
      "C G Am F",
      "Hej, hej, den sidste tønde",
      "den drikker vi i nat",
    ].join("\n"),
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000d3",
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Æbler i kælderen",
    artist: "Torsdagsdrengene",
    melody: null,
    body: [
      "Der ligger æbler i kælderen",
      "og cider i en kande",
      "vi henter dem om torsdagen",
      "når regnen slår mod strande",
      "",
      "Så sidder vi ved bordet",
      "med kinder røde af sol",
      "og æblerne fra kælderen",
      "smager bedre end en stol",
    ].join("\n"),
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000d4",
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Aalborg-valsen",
    artist: "Limfjordens Spillemænd",
    melody: null,
    body: [
      "D A D",
      "En, to, tre, og rundt vi går",
      "G D A D",
      "i Aalborg, hvor kroen står",
      "",
      "D A D",
      "Med harmonika og et glas",
      "G D A D",
      "vi danser til den sidste bas",
    ].join("\n"),
  },
  {
    id: "5eed0000-0000-7000-8000-0000000000d5",
    clubId: TORSDAG,
    createdBy: "mads",
    title: "Torsdagssangen",
    artist: null,
    melody: "Den gamle bådsmands vals",
    body: [
      "Nu er det torsdag igen",
      "og alle er her, min ven",
      "en øl og en sang",
      "og aftenen er lang",
    ].join("\n"),
  },
];

/** The synthetic songs, matched by fixed id or else by title key (one song per title, §9.6). */
async function seedSongs(db: PrismaClient, idOf: (key: SeedUserKey) => string): Promise<void> {
  for (const song of SEED_SONGS) {
    const title = cleanSongTitle(song.title);
    const titleKey = songTitleKey(title);
    const existing =
      (await db.song.findFirst({
        where: { id: song.id, clubId: song.clubId },
        select: { id: true },
      })) ??
      (await db.song.findFirst({ where: { clubId: song.clubId, titleKey }, select: { id: true } }));
    const data = {
      title,
      titleKey,
      artist: song.artist,
      melody: song.melody,
      body: cleanSongText(song.body),
    };
    if (existing) {
      await db.song.update({ where: { id: existing.id }, data });
    } else {
      await db.song.create({
        data: { id: song.id, clubId: song.clubId, createdById: idOf(song.createdBy), ...data },
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
          // Verified, as after "Forbind Google": app-admin needs it (D-165), and
          // the README makes the seed user Jesper the local app-admin.
          emailVerified: true,
        },
        update: { name: seedUser.name, nickname: seedUser.nickname, emailVerified: true },
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

    const placeIds = await seedEventsAndBeers(db, idOf);
    await seedSongs(db, idOf);
    await seedPolls(db, idOf, placeIds);
    await seedFeedback(db, idOf);

    // Jesper has two clubs and lands in his last active one; Mads has two and
    // gets the club picker; Anders has one and goes straight to it (SPEC §10.1).
    const jesperId = idOf("jesper");
    await db.user.updateMany({
      where: { id: jesperId, lastActiveClubId: null },
      data: { lastActiveClubId: SEED_CLUBS[0]?.id ?? null },
    });

    const [
      users,
      clubs,
      memberships,
      invites,
      places,
      owners,
      events,
      hosts,
      beers,
      ratings,
      songs,
      polls,
      ballots,
      feedback,
      feedbackVotes,
    ] = await Promise.all([
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
      db.song.count(),
      db.poll.count(),
      db.pollBallot.count(),
      db.feedback.count(),
      db.feedbackVote.count(),
    ]);
    console.info(
      `Seed færdig: ${users} brugere, ${clubs} klubber, ${memberships} medlemskaber, ${invites} aktive invitationer, ` +
        `${places} steder (${owners} ejerskaber), ${events} events (${hosts} værtskaber), ${beers} øl, ${ratings} ratings, ${songs} sange, ` +
        `${polls} afstemninger (${ballots} stemmesedler), ` +
        `${feedback} feedback-rapporter (${feedbackVotes} 👍).`,
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
