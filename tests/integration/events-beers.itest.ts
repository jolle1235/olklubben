import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { requireBeer } from "@/server/beers/access";
import {
  createBeer,
  deleteBeer,
  EventNotInClubError,
  removeRating,
  setRating,
  updateBeer,
} from "@/server/beers/mutations";
import { findSimilarBeers, getBeer, listClubBeers } from "@/server/beers/queries";
import { db } from "@/server/db";
import { formatRating } from "@/server/domain/ratings/ratings";
import { requireEvent } from "@/server/events/access";
import { createEvent, deleteEvent, updateEvent } from "@/server/events/mutations";
import {
  getEvent,
  getEventBeers,
  getNextEvent,
  listEventOptions,
  listEventsInRange,
  listUpcomingEvents,
} from "@/server/events/queries";

import {
  addMember,
  createClub,
  createUser,
  expectNotFound,
  setActor,
  type TestUser,
} from "./helpers";

/**
 * The round 2 data layer (src/server/events, src/server/beers) against the
 * real database: club scoping (SPEC §4.4), cross-club references, E13, E14,
 * the rating rules (D-003, Q6) and the CHECK constraints.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-08T10:00:00Z");
const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";

let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let clubId: string;
let otherClubId: string;

// Round 3: every event has a place ("＋ Nyt sted" reuses "Hos Itest" once it
// exists) and hosts (none chosen = the default).
const eventData = (title: string, startsAt: Date, endsAt: Date | null = null) => ({
  title,
  theme: null,
  description: null,
  place: { kind: "new" as const, name: "Hos Itest", address: null, ownedByCreator: false },
  hostIds: [],
  startsAt,
  endsAt,
});

beforeAll(async () => {
  admin = await createUser("Admin Itest");
  member = await createUser("Mads Itest");
  outsider = await createUser("Anden Klub");
  clubId = await createClub(admin, "Itest Bajere");
  await addMember(clubId, member);
  otherClubId = await createClub(outsider, "Itest Naboklub");
});

beforeEach(() => setActor(null));

describe("events: club scoping", () => {
  it("getEvent finds an event only in its own club", async () => {
    const { id } = await createEvent({
      clubId,
      createdById: member.id,
      ...eventData("Ølsmagning #1", new Date(NOW.getTime() + 3 * DAY)),
    });

    const event = await getEvent(clubId, id);
    expect(event).toMatchObject({
      id,
      title: "Ølsmagning #1",
      place: { name: "Hos Itest", address: null, archived: false },
      createdById: member.id,
      createdBy: { id: member.id, name: "Mads Itest", nickname: null },
      hostIds: [member.id],
    });
    expect(await getEvent(otherClubId, id)).toBeNull();
    expect(await getEvent(clubId, "not-an-id")).toBeNull();
    expect(await getEvent(clubId, UNKNOWN_ID)).toBeNull();
  });

  it("updateEvent and deleteEvent never touch another club's event", async () => {
    const { id } = await createEvent({
      clubId: otherClubId,
      createdById: outsider.id,
      ...eventData("Nabofest", new Date(NOW.getTime() + DAY)),
    });

    expect(
      await updateEvent({
        clubId,
        eventId: id,
        actorUserId: member.id,
        ...eventData("Kapret", new Date(NOW.getTime())),
      }),
    ).toBe(false);
    expect(await deleteEvent({ clubId, eventId: id })).toEqual({
      deleted: false,
      detachedBeerCount: 0,
    });
    expect((await getEvent(otherClubId, id))?.title).toBe("Nabofest");

    expect(
      await updateEvent({
        clubId: otherClubId,
        eventId: id,
        actorUserId: outsider.id,
        ...eventData("Nabofest 2", new Date(NOW.getTime() + DAY)),
      }),
    ).toBe(true);
    expect((await getEvent(otherClubId, id))?.title).toBe("Nabofest 2");
  });

  it("requireEvent gives 404 for another club's event, also to a member of both", async () => {
    const { id } = await createEvent({
      clubId: otherClubId,
      createdById: outsider.id,
      ...eventData("Kun for naboer", new Date(NOW.getTime() + DAY)),
    });
    setActor(member);
    await expectNotFound(requireEvent(clubId, id));
    await expectNotFound(requireEvent(clubId, "123"));
    // Not a member of the other club at all.
    await expectNotFound(requireEvent(otherClubId, id));

    setActor(outsider);
    const access = await requireEvent(otherClubId, id);
    expect(access.event.title).toBe("Kun for naboer");
    expect(access.membership.role).toBe("ADMIN");
  });
});

describe("events: upcoming, ongoing and ranges (SPEC §9.1, §9.3)", () => {
  let scopeClub: string;

  beforeAll(async () => {
    scopeClub = await createClub(admin, "Itest Tidsklub");
    const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);
    for (const [title, startsAt, endsAt] of [
      ["Forbi", at(-3 * DAY), at(-3 * DAY + 5 * HOUR)],
      ["Forbi uden slut", at(-7 * HOUR), null],
      ["I gang uden slut", at(-2 * HOUR), null],
      ["I gang med slut", at(-4 * HOUR), at(HOUR)],
      ["Om tre dage", at(3 * DAY), null],
      ["Om fire uger", at(28 * DAY), at(28 * DAY + 5 * HOUR)],
    ] as const) {
      await createEvent({
        clubId: scopeClub,
        createdById: admin.id,
        ...eventData(title, startsAt, endsAt),
      });
    }
    // Noise in another club.
    await createEvent({
      clubId: otherClubId,
      createdById: outsider.id,
      ...eventData("Naboens næste", at(HOUR)),
    });
  });

  it("getNextEvent is the earliest event that has not ended (start + 6 h without end)", async () => {
    expect((await getNextEvent(scopeClub, NOW))?.title).toBe("I gang med slut");
  });

  it("listUpcomingEvents lists upcoming and ongoing events, oldest first", async () => {
    const titles = (await listUpcomingEvents(scopeClub, NOW)).map((e) => e.title);
    expect(titles).toEqual(["I gang med slut", "I gang uden slut", "Om tre dage", "Om fire uger"]);

    const next = await getNextEvent(scopeClub, NOW);
    const rest = await listUpcomingEvents(scopeClub, NOW, { excludeId: next?.id, limit: 2 });
    expect(rest.map((e) => e.title)).toEqual(["I gang uden slut", "Om tre dage"]);
  });

  it("listEventsInRange is half-open on startsAt", async () => {
    const from = new Date(NOW.getTime() - 3 * DAY);
    const to = new Date(NOW.getTime() + 3 * DAY);
    const titles = (await listEventsInRange(scopeClub, from, to)).map((e) => e.title);
    expect(titles).toEqual(["Forbi", "Forbi uden slut", "I gang med slut", "I gang uden slut"]);
  });

  it("listEventOptions is newest first and scoped to the club", async () => {
    const options = await listEventOptions(scopeClub);
    expect(options[0]?.title).toBe("Om fire uger");
    expect(options.at(-1)?.title).toBe("Forbi");
    expect(Object.keys(options[0] ?? {}).sort()).toEqual(["id", "startsAt", "title"]);
    // The six events of this club, without the other club's "Naboens næste".
    expect(options).toHaveLength(6);
    expect(options.map((option) => option.title)).not.toContain("Naboens næste");
  });
});

describe("beers: event in the same club (§4.4)", () => {
  it("createBeer and updateBeer refuse an event of another club", async () => {
    const { id: foreignEvent } = await createEvent({
      clubId: otherClubId,
      createdById: outsider.id,
      ...eventData("Fremmed event", NOW),
    });
    await expect(
      createBeer({ clubId, createdById: member.id, name: "Snyd", abv: 5, eventId: foreignEvent }),
    ).rejects.toBeInstanceOf(EventNotInClubError);
    await expect(
      createBeer({ clubId, createdById: member.id, name: "Snyd", abv: 5, eventId: UNKNOWN_ID }),
    ).rejects.toBeInstanceOf(EventNotInClubError);
    expect(await db.beer.count({ where: { name: "Snyd" } })).toBe(0);

    const { id } = await createBeer({
      clubId,
      createdById: member.id,
      name: "Ærlig Ale",
      abv: 5.2,
      eventId: null,
    });
    await expect(
      updateBeer({ clubId, beerId: id, name: "Ærlig Ale", abv: 5.2, eventId: foreignEvent }),
    ).rejects.toBeInstanceOf(EventNotInClubError);
    expect((await db.beer.findUniqueOrThrow({ where: { id } })).eventId).toBeNull();
  });

  it("stores the ABV exactly with one decimal", async () => {
    const { id } = await createBeer({
      clubId,
      createdById: admin.id,
      name: "Præcis Pilsner",
      abv: 5.2,
      eventId: null,
    });
    const row = await db.beer.findUniqueOrThrow({ where: { id } });
    expect(row.abv.toString()).toBe("5.2");
    expect((await getBeer(clubId, id, admin.id))?.abv).toBe(5.2);
  });

  it("updateBeer and deleteBeer never touch another club's beer", async () => {
    const { id } = await createBeer({
      clubId: otherClubId,
      createdById: outsider.id,
      name: "Naboøl",
      abv: 6,
      eventId: null,
    });
    expect(await updateBeer({ clubId, beerId: id, name: "Kapret", abv: 1, eventId: null })).toBe(
      false,
    );
    expect(await deleteBeer({ clubId, beerId: id })).toEqual({ deleted: false, ratingCount: 0 });
    expect(await getBeer(clubId, id, member.id)).toBeNull();
    expect((await getBeer(otherClubId, id, outsider.id))?.name).toBe("Naboøl");
  });
});

describe("ratings (D-003, Q6)", () => {
  let beerId: string;

  beforeAll(async () => {
    ({ id: beerId } = await createBeer({
      clubId,
      createdById: member.id,
      name: "Westmalle Tripel",
      abv: 9.5,
      eventId: null,
    }));
  });

  it("setRating creates one row per member and changes it", async () => {
    expect(await setRating({ clubId, beerId, userId: member.id, value: 8 })).toBe(true);
    expect(await setRating({ clubId, beerId, userId: member.id, value: 9 })).toBe(true);
    expect(await setRating({ clubId, beerId, userId: admin.id, value: 10 })).toBe(true);
    const rows = await db.beerRating.findMany({ where: { beerId }, orderBy: { value: "asc" } });
    expect(rows.map((r) => [r.userId, r.value])).toEqual([
      [member.id, 9],
      [admin.id, 10],
    ]);
  });

  it("setRating and removeRating refuse a beer of another club", async () => {
    expect(await setRating({ clubId: otherClubId, beerId, userId: outsider.id, value: 2 })).toBe(
      false,
    );
    expect(await removeRating({ clubId: otherClubId, beerId, userId: member.id })).toBe(false);
    expect(await db.beerRating.count({ where: { beerId } })).toBe(2);
  });

  it("setRating refuses values outside 2..10, and so does the database", async () => {
    await expect(setRating({ clubId, beerId, userId: member.id, value: 11 })).rejects.toThrow(
      RangeError,
    );
    await expect(setRating({ clubId, beerId, userId: member.id, value: 4.5 })).rejects.toThrow(
      RangeError,
    );
    await expect(
      db.beerRating.update({
        where: { beerId_userId: { beerId, userId: member.id } },
        data: { value: 1 },
      }),
    ).rejects.toThrow(/beer_ratings_value_range_check/);
  });

  it("getBeer shows the average, the count, my rating and every rating sorted", async () => {
    const beer = await getBeer(clubId, beerId, member.id);
    expect(beer).toMatchObject({
      name: "Westmalle Tripel",
      abv: 9.5,
      averageStars: 4.75,
      ratingCount: 2,
      myRating: 9,
      createdBy: { id: member.id, name: "Mads Itest" },
      event: null,
    });
    expect(beer?.ratings.map((r) => [r.user.name, r.value])).toEqual([
      ["Admin Itest", 10],
      ["Mads Itest", 9],
    ]);
    expect(formatRating(beer?.averageStars ?? 0)).toBe("4,8");
  });

  it("listClubBeers aggregates per beer and shows only the club's beers", async () => {
    const beers = await listClubBeers(clubId, admin.id);
    const westmalle = beers.find((b) => b.id === beerId);
    expect(westmalle).toMatchObject({ averageStars: 4.75, ratingCount: 2, myRating: 10 });
    expect(beers.some((b) => b.name === "Naboøl")).toBe(false);
    const unrated = beers.find((b) => b.name === "Præcis Pilsner");
    expect(unrated).toMatchObject({ averageStars: null, ratingCount: 0, myRating: null });
  });

  it("removeRating removes only my rating and is idempotent", async () => {
    expect(await removeRating({ clubId, beerId, userId: admin.id })).toBe(true);
    expect(await removeRating({ clubId, beerId, userId: admin.id })).toBe(true);
    expect((await getBeer(clubId, beerId, admin.id))?.myRating).toBeNull();
    expect(await db.beerRating.count({ where: { beerId } })).toBe(1);
    await setRating({ clubId, beerId, userId: admin.id, value: 10 });
  });

  it("a former member's rating still counts (Q6) and their name stays", async () => {
    const former = await createUser("Tidligere Itest");
    await addMember(clubId, former);
    await setRating({ clubId, beerId, userId: former.id, value: 4 });
    await db.membership.delete({ where: { userId_clubId: { userId: former.id, clubId } } });

    const beer = await getBeer(clubId, beerId, admin.id);
    expect(beer?.ratingCount).toBe(3);
    expect(beer?.ratings.at(-1)).toMatchObject({ user: { name: "Tidligere Itest" }, value: 4 });
  });

  it("requireBeer gives 404 for another club's beer", async () => {
    setActor(outsider);
    await expectNotFound(requireBeer(otherClubId, beerId));
    setActor(member);
    expect((await requireBeer(clubId, beerId)).beer.myRating).toBe(9);
    await expectNotFound(requireBeer(clubId, "123"));
  });
});

describe("deleting (E13, E14)", () => {
  it("deleting an event keeps its beers and ratings, without the link (E13)", async () => {
    const { id: eventId } = await createEvent({
      clubId,
      createdById: admin.id,
      ...eventData("Ølsmagning #12", new Date(NOW.getTime() - 21 * DAY)),
    });
    const { id: beerId } = await createBeer({
      clubId,
      createdById: admin.id,
      name: "Grimbergen Dubbel",
      abv: 6.5,
      eventId,
    });
    await setRating({ clubId, beerId, userId: member.id, value: 9 });

    const eventBeers = await getEventBeers(clubId, eventId, member.id);
    expect(eventBeers).toEqual([
      expect.objectContaining({
        id: beerId,
        abv: 6.5,
        averageStars: 4.5,
        ratingCount: 1,
        myRating: 9,
      }),
    ]);
    expect(await getEventBeers(otherClubId, eventId)).toEqual([]);

    expect(await deleteEvent({ clubId, eventId })).toEqual({ deleted: true, detachedBeerCount: 1 });
    const beer = await getBeer(clubId, beerId, member.id);
    expect(beer).toMatchObject({ eventId: null, event: null, ratingCount: 1 });
  });

  it("deleting a beer deletes its ratings and says how many (E14)", async () => {
    const { id: beerId } = await createBeer({
      clubId,
      createdById: member.id,
      name: "Kortvarig Stout",
      abv: 7,
      eventId: null,
    });
    await setRating({ clubId, beerId, userId: member.id, value: 6 });
    await setRating({ clubId, beerId, userId: admin.id, value: 7 });

    expect(await deleteBeer({ clubId, beerId })).toEqual({ deleted: true, ratingCount: 2 });
    expect(await db.beerRating.count({ where: { beerId } })).toBe(0);
    expect(await deleteBeer({ clubId, beerId })).toEqual({ deleted: false, ratingCount: 0 });
  });
});

describe("findSimilarBeers (E21)", () => {
  it("matches the same name regardless of case and whitespace, in the club only", async () => {
    const { id } = await createBeer({
      clubId,
      createdById: member.id,
      name: "Ørbæk Fynsk Forår",
      abv: 5,
      eventId: null,
    });
    await createBeer({
      clubId: otherClubId,
      createdById: outsider.id,
      name: "Ørbæk Fynsk Forår",
      abv: 5,
      eventId: null,
    });

    expect(await findSimilarBeers(clubId, "  ØRBÆK   fynsk forår ")).toEqual([
      { id, name: "Ørbæk Fynsk Forår", abv: 5 },
    ]);
    expect(await findSimilarBeers(clubId, "Ørbæk Fynsk Forår", id)).toEqual([]);
    expect(await findSimilarBeers(clubId, "Ørbæk")).toEqual([]);
    expect(await findSimilarBeers(clubId, "   ")).toEqual([]);
  });
});

describe("database constraints (§15.4)", () => {
  it("refuses an end before the start, empty titles and an ABV of 100", async () => {
    await expect(
      createEvent({
        clubId,
        createdById: admin.id,
        ...eventData("Baglæns", NOW, new Date(NOW.getTime() - HOUR)),
      }),
    ).rejects.toThrow(/events_ends_after_start_check/);
    await expect(
      createEvent({ clubId, createdById: admin.id, ...eventData("   ", NOW) }),
    ).rejects.toThrow(/events_title_length_check/);
    await expect(
      createBeer({ clubId, createdById: admin.id, name: "Rå sprit", abv: 100, eventId: null }),
    ).rejects.toThrow(/beers_abv_range_check|numeric field overflow/);
  });

  it("a user who created club history cannot be hard-deleted (RESTRICT)", async () => {
    const creator = await createUser("Skaber Itest");
    await addMember(clubId, creator);
    await createEvent({ clubId, createdById: creator.id, ...eventData("Mit event", NOW) });
    await expect(db.user.delete({ where: { id: creator.id } })).rejects.toThrow();
    expect(await db.user.count({ where: { id: creator.id } })).toBe(1);
  });
});
