import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { createBeerAction, deleteBeerAction, updateBeerAction } from "@/server/actions/beers";
import { createEventAction, deleteEventAction, updateEventAction } from "@/server/actions/events";
import { rateBeerAction, removeRatingAction } from "@/server/actions/ratings";
import { createBeer, setRating } from "@/server/beers/mutations";
import { db } from "@/server/db";
import { createEvent } from "@/server/events/mutations";

import {
  addMember,
  createClub,
  createPlace,
  createUser,
  expectNotFound,
  expectRedirect,
  formData,
  setActor,
  type TestUser,
} from "./helpers";

/**
 * The round 2 Server Actions (events, beers, ratings) against the real
 * database (SPEC §15.3 "Integration"): validation, membership (non-member →
 * 404), the resource in THIS club (another club or a malformed id → 404,
 * §4.4), the creator-host-or-admin rule (D-098, which replaced D-061; §5.1)
 * and the redirects with their toast flags. Hidden buttons are only UX; these
 * calls are what a forged request would do.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";
const DAY = 24 * 60 * 60 * 1000;

let admin: TestUser;
let creator: TestUser;
let member: TestUser;
let outsider: TestUser;
let clubId: string;
let otherClubId: string;
let otherClubEventId: string;
let otherClubBeerId: string;

// Round 3: the place is "＋ Nyt sted" by name (the interim form); no hosts
// chosen = the default (the place's owners, else the creator).
const eventFields = (overrides: Record<string, string> = {}) => ({
  title: "Ølsmagning #7",
  date: "2026-11-20",
  startTime: "18:30",
  endTime: "",
  placeId: "new",
  newPlaceName: "Hos Itest",
  theme: "",
  description: "",
  ...overrides,
});

const newPlace = (name: string) => ({
  kind: "new" as const,
  name,
  address: null,
  ownedByCreator: false,
});

async function insertEvent(createdBy: TestUser, title = "Itest-smagning", hostIds: string[] = []) {
  const { id } = await createEvent({
    clubId,
    createdById: createdBy.id,
    title,
    theme: null,
    description: null,
    place: newPlace("Hos Itest"),
    hostIds,
    startsAt: new Date(Date.now() + 10 * DAY),
    endsAt: null,
  });
  return id;
}

async function insertBeer(createdBy: TestUser, name: string, eventId: string | null = null) {
  const { id } = await createBeer({ clubId, createdById: createdBy.id, name, abv: 6.5, eventId });
  return id;
}

beforeAll(async () => {
  admin = await createUser("Admin Runde2");
  creator = await createUser("Opretter Runde2");
  member = await createUser("Medlem Runde2");
  outsider = await createUser("Nabo Runde2");
  clubId = await createClub(admin, "Runde 2-klubben");
  await addMember(clubId, creator);
  await addMember(clubId, member);
  otherClubId = await createClub(outsider, "Naboklubben");
  ({ id: otherClubEventId } = await createEvent({
    clubId: otherClubId,
    createdById: outsider.id,
    title: "Nabosmagning",
    theme: null,
    description: null,
    place: newPlace("Hos naboen"),
    hostIds: [],
    startsAt: new Date(Date.now() + 5 * DAY),
    endsAt: null,
  }));
  ({ id: otherClubBeerId } = await createBeer({
    clubId: otherClubId,
    createdById: outsider.id,
    name: "Naboøl",
    abv: 5,
    eventId: otherClubEventId,
  }));
});

beforeEach(() => setActor(null));

describe("createEventAction", () => {
  it("creates the event as the member, in Copenhagen time, and opens it with a toast", async () => {
    setActor(member);
    const url = await expectRedirect(
      createEventAction(
        null,
        formData({ clubId, ...eventFields({ endTime: "01:00", theme: " Belgiske  øl " }) }),
      ),
      new RegExp(`^/c/${clubId}/events/(${UUID})\\?toast=event-created$`),
    );
    const eventId = url.split("/").pop()?.split("?")[0] ?? "";
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.clubId).toBe(clubId);
    expect(event.createdById).toBe(member.id);
    expect(event.theme).toBe("Belgiske øl");
    // 18:30 CET (winter time) = 17:30 UTC; 01:00 is the next day.
    expect(event.startsAt.toISOString()).toBe("2026-11-20T17:30:00.000Z");
    expect(event.endsAt?.toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("returns the field errors and echoes what was typed", async () => {
    setActor(member);
    const state = await createEventAction(
      null,
      formData({ clubId, ...eventFields({ title: " ", date: "", endTime: "18:30" }) }),
    );
    expect(state?.ok).toBe(false);
    expect(state?.error.code).toBe(ACTION_ERROR_CODES.VALIDATION);
    expect(state?.error.fieldErrors).toEqual({
      title: ["Giv eventet en titel."],
      date: ["Vælg en dato."],
      endTime: ["Sluttiden skal være en anden end starttiden."],
    });
    expect(state?.values.newPlaceName).toBe("Hos Itest");
  });

  it("strips NUL characters, which Postgres text cannot store, instead of failing", async () => {
    setActor(member);
    const url = await expectRedirect(
      createEventAction(
        null,
        formData({
          clubId,
          ...eventFields({ title: "Nul\u0000smagning", description: "Først\u0000 pizza." }),
        }),
      ),
      new RegExp(`^/c/${clubId}/events/(${UUID})\\?toast=event-created$`),
    );
    const eventId = url.split("/").pop()?.split("?")[0] ?? "";
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.title).toBe("Nulsmagning");
    expect(event.description).toBe("Først pizza.");
  });

  it("gives a non-member and a malformed club id a 404, and writes nothing", async () => {
    const before = await db.event.count({ where: { clubId } });
    setActor(outsider);
    await expectNotFound(createEventAction(null, formData({ clubId, ...eventFields() })));
    await expectNotFound(createEventAction(null, formData({ clubId: "x", ...eventFields() })));
    setActor(null);
    await expect(
      createEventAction(null, formData({ clubId, ...eventFields() })),
    ).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/login/) });
    expect(await db.event.count({ where: { clubId } })).toBe(before);
  });
});

describe("updateEventAction and deleteEventAction (D-098)", () => {
  it("refuses a member who neither created nor hosts the event, without writing", async () => {
    const eventId = await insertEvent(creator, "Opretterens smagning");
    await insertBeer(creator, "Bliver-øl", eventId);
    setActor(member);

    const state = await updateEventAction(
      null,
      formData({ clubId, eventId, ...eventFields({ title: "Overtaget" }) }),
    );
    expect(state?.error.code).toBe(ACTION_ERROR_CODES.FORBIDDEN);
    expect(state?.error.message).toBe(
      "Kun opretteren, værterne og klubbens admins kan rette eventet.",
    );
    const deleted = await deleteEventAction(clubId, eventId);
    expect(deleted).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });

    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.title).toBe("Opretterens smagning");
  });

  it("lets the creator and an admin edit, and the creator delete (beers stay, E13)", async () => {
    const eventId = await insertEvent(creator);
    const beerId = await insertBeer(creator, "Overlever-øl", eventId);

    setActor(creator);
    await expectRedirect(
      updateEventAction(null, formData({ clubId, eventId, ...eventFields({ title: "Rettet" }) })),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    setActor(admin);
    await expectRedirect(
      updateEventAction(
        null,
        formData({ clubId, eventId, ...eventFields({ title: "Rettet af admin" }) }),
      ),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).title).toBe(
      "Rettet af admin",
    );

    setActor(creator);
    await expectRedirect(
      deleteEventAction(clubId, eventId),
      `/c/${clubId}?toast=event-deleted-beers-kept`,
    );
    expect(await db.event.findUnique({ where: { id: eventId } })).toBeNull();
    expect((await db.beer.findUniqueOrThrow({ where: { id: beerId } })).eventId).toBeNull();
  });

  it("lets a host who did not create the event edit and delete it (D-098)", async () => {
    const eventId = await insertEvent(creator, "Værtens smagning", [member.id]);
    setActor(member);
    await expectRedirect(
      updateEventAction(
        null,
        formData({
          clubId,
          eventId,
          ...eventFields({ title: "Rettet af værten" }),
          hostIds: [member.id],
        }),
      ),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).title).toBe(
      "Rettet af værten",
    );
    await expectRedirect(deleteEventAction(clubId, eventId), `/c/${clubId}?toast=event-deleted`);
  });

  it("an admin may delete a member's event; without beers the toast says so", async () => {
    const eventId = await insertEvent(member);
    setActor(admin);
    await expectRedirect(deleteEventAction(clubId, eventId), `/c/${clubId}?toast=event-deleted`);
  });

  it("gives 404 for another club's event, an unknown or a malformed id", async () => {
    setActor(admin);
    for (const eventId of [otherClubEventId, UNKNOWN_ID, "123"]) {
      await expectNotFound(
        updateEventAction(null, formData({ clubId, eventId, ...eventFields() })),
      );
      await expectNotFound(deleteEventAction(clubId, eventId));
    }
    // The outsider's own event, but through this club's id: not a member → 404.
    setActor(outsider);
    await expectNotFound(deleteEventAction(clubId, otherClubEventId));
    expect(await db.event.findUnique({ where: { id: otherClubEventId } })).not.toBeNull();
  });
});

describe("event actions: place and hosts (round 3, D-098, D-099)", () => {
  it("chooses an existing place, with chosen hosts as a repeated field", async () => {
    const placeId = await createPlace(clubId, admin, "Hos Admin", { ownerIds: [admin.id] });
    setActor(member);
    const url = await expectRedirect(
      createEventAction(
        null,
        formData({ clubId, ...eventFields({ placeId }), hostIds: [member.id, creator.id] }),
      ),
      new RegExp(`^/c/${clubId}/events/(${UUID})\\?toast=event-created$`),
    );
    const eventId = url.split("/").pop()?.split("?")[0] ?? "";
    const event = await db.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { hosts: { select: { userId: true } } },
    });
    expect(event.placeId).toBe(placeId);
    expect(event.hosts.map((host) => host.userId).sort()).toEqual([creator.id, member.id].sort());
  });

  it("maps a gone, foreign or archived place to fieldErrors.placeId", async () => {
    const foreign = await createPlace(otherClubId, outsider, "Naboens sted");
    const archived = await createPlace(clubId, admin, "Arkiveret sted", { archived: true });
    setActor(member);
    for (const [placeId, message] of [
      [foreign, "Stedet findes ikke længere. Vælg et andet."],
      [UNKNOWN_ID, "Stedet findes ikke længere. Vælg et andet."],
      [archived, "Stedet er arkiveret. Vælg et andet."],
    ] as const) {
      const state = await createEventAction(
        null,
        formData({ clubId, ...eventFields({ placeId }) }),
      );
      expect(state?.error).toMatchObject({
        code: ACTION_ERROR_CODES.VALIDATION,
        fieldErrors: { placeId: [message] },
      });
      expect(state?.values.placeId).toBe(placeId);
    }
  });

  it("maps a host from outside the club to fieldErrors.hostIds and writes nothing", async () => {
    const before = await db.event.count({ where: { clubId } });
    setActor(member);
    const state = await createEventAction(
      null,
      formData({
        clubId,
        ...eventFields({ newPlaceName: "Aldrig oprettet" }),
        hostIds: [outsider.id],
      }),
    );
    expect(state?.error.fieldErrors).toEqual({
      hostIds: ["Vælg værter blandt klubbens medlemmer."],
    });
    expect(state?.values.hostIds).toEqual([outsider.id]);
    expect(await db.event.count({ where: { clubId } })).toBe(before);
    expect(await db.place.count({ where: { clubId, name: "Aldrig oprettet" } })).toBe(0);
  });
});

describe("createBeerAction (§9.5, E21)", () => {
  it("adds a beer to one of the club's events and opens it with a toast", async () => {
    const eventId = await insertEvent(admin);
    setActor(member);
    const url = await expectRedirect(
      createBeerAction(
        null,
        formData({
          clubId,
          name: "  Westmalle   Dubbel ",
          abv: "7,0",
          eventId,
          confirmDuplicate: "",
        }),
      ),
      new RegExp(`^/c/${clubId}/beers/(${UUID})\\?toast=beer-created$`),
    );
    const beerId = url.split("/").pop()?.split("?")[0] ?? "";
    const beer = await db.beer.findUniqueOrThrow({ where: { id: beerId } });
    expect(beer).toMatchObject({ name: "Westmalle Dubbel", eventId, createdById: member.id });
    expect(beer.abv.toFixed(1)).toBe("7.0");
  });

  it("warns about a duplicate (any case and spacing) and adds it when confirmed", async () => {
    const existingId = await insertBeer(admin, "Ørbæk Fynsk Forår");
    setActor(member);
    const fields = { clubId, name: "ØRBÆK  fynsk forår", abv: "5", eventId: "" };

    const state = await createBeerAction(null, formData({ ...fields, confirmDuplicate: "" }));
    expect(state?.error.code).toBe("DUPLICATE_BEER");
    expect(state?.error.message).toBe("Den her har I vist smagt før 👀");
    expect(state?.duplicates?.map((beer) => beer.id)).toEqual([existingId]);

    await expectRedirect(
      createBeerAction(null, formData({ ...fields, confirmDuplicate: "1" })),
      /\/beers\/[0-9a-f-]{36}\?toast=beer-created$/,
    );
  });

  it("refuses an event of another club as a field error, and bad input", async () => {
    setActor(member);
    const state = await createBeerAction(
      null,
      formData({ clubId, name: "Snydeøl", abv: "5", eventId: otherClubEventId }),
    );
    expect(state?.error.fieldErrors).toEqual({ eventId: ["Vælg et event fra listen."] });

    const invalid = await createBeerAction(null, formData({ clubId, name: " ", abv: "5,25" }));
    expect(invalid?.error.code).toBe(ACTION_ERROR_CODES.VALIDATION);
    expect(Object.keys(invalid?.error.fieldErrors ?? {}).sort()).toEqual(["abv", "name"]);
    expect(await db.beer.count({ where: { name: "Snydeøl" } })).toBe(0);
  });

  it("gives a non-member a 404", async () => {
    setActor(outsider);
    await expectNotFound(createBeerAction(null, formData({ clubId, name: "Ude", abv: "5" })));
  });
});

describe("updateBeerAction and deleteBeerAction (§5.1, E14)", () => {
  it("refuses a member who did not add the beer", async () => {
    const beerId = await insertBeer(creator, "Opretterens øl");
    setActor(member);
    const state = await updateBeerAction(
      null,
      formData({ clubId, beerId, name: "Overtaget", abv: "5", eventId: "" }),
    );
    expect(state?.error.code).toBe(ACTION_ERROR_CODES.FORBIDDEN);
    expect(await deleteBeerAction(clubId, beerId)).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN },
    });
    expect((await db.beer.findUniqueOrThrow({ where: { id: beerId } })).name).toBe(
      "Opretterens øl",
    );
  });

  it("lets an admin edit and the creator delete it with its ratings", async () => {
    const beerId = await insertBeer(creator, "Slettes snart");
    await setRating({ clubId, beerId, userId: member.id, value: 7 });
    await setRating({ clubId, beerId, userId: admin.id, value: 9 });

    setActor(admin);
    await expectRedirect(
      updateBeerAction(
        null,
        formData({ clubId, beerId, name: "Slettes snart", abv: "8,5", eventId: "" }),
      ),
      `/c/${clubId}/beers/${beerId}?toast=beer-updated`,
    );
    expect((await db.beer.findUniqueOrThrow({ where: { id: beerId } })).abv.toFixed(1)).toBe("8.5");

    setActor(creator);
    await expectRedirect(deleteBeerAction(clubId, beerId), `/c/${clubId}/beers?toast=beer-deleted`);
    expect(await db.beer.findUnique({ where: { id: beerId } })).toBeNull();
    expect(await db.beerRating.count({ where: { beerId } })).toBe(0);
  });

  it("warns when a rename matches another beer (D-083) and saves it when confirmed", async () => {
    const targetId = await insertBeer(admin, "Omdøb Tripel");
    const sourceId = await insertBeer(creator, "Omdøb Kilde");
    setActor(creator);
    const fields = { clubId, beerId: sourceId, name: "omdøb  TRIPEL", abv: "6,5", eventId: "" };

    const state = await updateBeerAction(null, formData({ ...fields, confirmDuplicate: "" }));
    expect(state?.error.code).toBe("DUPLICATE_BEER");
    expect(state?.duplicates?.map((beer) => beer.id)).toEqual([targetId]);
    expect((await db.beer.findUniqueOrThrow({ where: { id: sourceId } })).name).toBe("Omdøb Kilde");

    await expectRedirect(
      updateBeerAction(null, formData({ ...fields, confirmDuplicate: "1" })),
      `/c/${clubId}/beers/${sourceId}?toast=beer-updated`,
    );
    expect((await db.beer.findUniqueOrThrow({ where: { id: sourceId } })).name).toBe(
      "omdøb TRIPEL",
    );
  });

  it("counts a name that differs only in spaces as a duplicate (E21)", async () => {
    const targetId = await insertBeer(admin, "Mellemrum Dubbel");
    const beerId = await insertBeer(creator, "Mellemrum Kilde");
    setActor(creator);
    const state = await updateBeerAction(
      null,
      formData({ clubId, beerId, name: "MellemrumDubbel", abv: "6,5", eventId: "" }),
    );
    expect(state?.error.code).toBe("DUPLICATE_BEER");
    expect(state?.duplicates?.map((beer) => beer.id)).toEqual([targetId]);
    expect((await db.beer.findUniqueOrThrow({ where: { id: beerId } })).name).toBe(
      "Mellemrum Kilde",
    );
  });

  it("saves a change of case or spacing in the beer's own name without a warning", async () => {
    const beerId = await insertBeer(creator, "Selv Øl");
    setActor(creator);
    await expectRedirect(
      updateBeerAction(
        null,
        formData({
          clubId,
          beerId,
          name: "SELV   øl",
          abv: "6,5",
          eventId: "",
          confirmDuplicate: "",
        }),
      ),
      `/c/${clubId}/beers/${beerId}?toast=beer-updated`,
    );
    expect((await db.beer.findUniqueOrThrow({ where: { id: beerId } })).name).toBe("SELV øl");
  });

  it("refuses another club's event on update as a field error, without writing", async () => {
    const beerId = await insertBeer(creator, "Opdater Snyd");
    setActor(creator);
    const state = await updateBeerAction(
      null,
      formData({ clubId, beerId, name: "Opdater Snyd 2", abv: "5", eventId: otherClubEventId }),
    );
    expect(state?.error.fieldErrors).toEqual({ eventId: ["Vælg et event fra listen."] });
    expect(await db.beer.findUniqueOrThrow({ where: { id: beerId } })).toMatchObject({
      name: "Opdater Snyd",
      eventId: null,
    });
  });

  it("gives 404 for another club's beer, an unknown or a malformed id", async () => {
    setActor(admin);
    for (const beerId of [otherClubBeerId, UNKNOWN_ID, "123"]) {
      await expectNotFound(
        updateBeerAction(null, formData({ clubId, beerId, name: "X", abv: "5", eventId: "" })),
      );
      await expectNotFound(deleteBeerAction(clubId, beerId));
    }
    expect(await db.beer.findUnique({ where: { id: otherClubBeerId } })).not.toBeNull();
  });
});

describe("rateBeerAction and removeRatingAction (D-003)", () => {
  it("sets, changes and removes only the member's own rating", async () => {
    const beerId = await insertBeer(admin, "Ratingøl");
    await setRating({ clubId, beerId, userId: admin.id, value: 10 });

    setActor(member);
    expect(await rateBeerAction({ clubId, beerId, value: 9 })).toEqual({
      ok: true,
      data: { value: 9 },
    });
    expect(await rateBeerAction({ clubId, beerId, value: 7 })).toMatchObject({ ok: true });
    const mine = await db.beerRating.findUniqueOrThrow({
      where: { beerId_userId: { beerId, userId: member.id } },
    });
    expect(mine.value).toBe(7);

    expect(await removeRatingAction({ clubId, beerId })).toEqual({ ok: true, data: null });
    // Idempotent, and the admin's rating is untouched.
    expect(await removeRatingAction({ clubId, beerId })).toEqual({ ok: true, data: null });
    const left = await db.beerRating.findMany({ where: { beerId }, select: { userId: true } });
    expect(left).toEqual([{ userId: admin.id }]);
  });

  it("refuses values outside 1–5 stars in half steps", async () => {
    const beerId = await insertBeer(admin, "Grænseøl");
    setActor(member);
    for (const value of [1, 11, 4.5, Number.NaN]) {
      const result = await rateBeerAction({ clubId, beerId, value });
      expect(result).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.VALIDATION } });
    }
    expect(await db.beerRating.count({ where: { beerId } })).toBe(0);
  });

  it("gives 404 for another club's beer, a malformed id and a non-member", async () => {
    setActor(member);
    await expectNotFound(rateBeerAction({ clubId, beerId: otherClubBeerId, value: 8 }));
    await expectNotFound(removeRatingAction({ clubId, beerId: otherClubBeerId }));
    await expectNotFound(rateBeerAction({ clubId, beerId: "123", value: 8 }));
    // The outsider's own beer, but through this club's id.
    setActor(outsider);
    await expectNotFound(rateBeerAction({ clubId, beerId: otherClubBeerId, value: 8 }));
    expect(await db.beerRating.count({ where: { beerId: otherClubBeerId } })).toBe(0);
  });
});
