import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { initialPlaceId, toPlaceChoices } from "@/components/features/events/event-form-state";
import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { createEventAction, deleteEventAction, updateEventAction } from "@/server/actions/events";
import { db } from "@/server/db";
import { createEvent } from "@/server/events/mutations";
import { listPlaceOptions } from "@/server/places/queries";

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
 * Round 3, agent C: the event Server Actions with places and hosts (SPEC
 * §9.2, D-098, D-099, E29–E31) against the real database – the combinations
 * the PlaceSelector and HostsPicker can send (and a forged request can), the
 * creator/host/admin rule with its new copy, and the data behind the
 * ?placeId= prefill. Run on the agent's own database:
 *
 *   ITEST_DATABASE_URL=postgresql://postgres@localhost:5432/olklubben_c_itest \
 *     npx vitest run --config vitest.integration.config.mts tests/integration/round3-events.itest.ts
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";
const DAY = 24 * 60 * 60 * 1000;

const NOT_ALLOWED_TO_EDIT = "Kun opretteren, værterne og klubbens admins kan rette eventet.";
const NOT_ALLOWED_TO_DELETE = "Kun opretteren, værterne og klubbens admins kan slette eventet.";
const PLACE_GONE = "Stedet findes ikke længere. Vælg et andet.";
const PLACE_ARCHIVED = "Stedet er arkiveret. Vælg et andet.";
const INVALID_HOSTS = "Vælg værter blandt klubbens medlemmer.";

let admin: TestUser;
let mads: TestUser;
let anders: TestUser;
let bo: TestUser;
let former: TestUser;
let outsider: TestUser;
let clubId: string;
let otherClubId: string;
let hosMads: string;
let hosMadsOgAnders: string;
let baren: string;
let klubhuset: string;
let naboensSted: string;

/** The event form's fields; `hostIds` is the repeated field (empty = the default). */
function fields(overrides: Record<string, string | string[]> = {}) {
  return {
    clubId,
    title: "Ølsmagning #20",
    date: "2026-12-04",
    startTime: "19:00",
    endTime: "",
    placeId: "",
    newPlaceName: "",
    newPlaceAddress: "",
    theme: "",
    description: "",
    ...overrides,
  };
}

async function hostIdsOf(eventId: string): Promise<string[]> {
  const rows = await db.eventHost.findMany({ where: { eventId }, select: { userId: true } });
  return rows.map((row) => row.userId).sort();
}

const sorted = (ids: string[]) => [...ids].sort();

/** Creates through the action and returns the new event's id. */
async function createVia(actor: TestUser, overrides: Record<string, string | string[]>) {
  setActor(actor);
  const url = await expectRedirect(
    createEventAction(null, formData(fields(overrides))),
    new RegExp(`^/c/${clubId}/events/(${UUID})\\?toast=event-created$`),
  );
  return url.split("/").pop()?.split("?")[0] ?? "";
}

/** An event written directly (the setup for edit tests). */
async function insertEvent(createdBy: TestUser, placeId: string, hostIds: string[]) {
  const { id } = await createEvent({
    clubId,
    createdById: createdBy.id,
    title: "Itest-smagning",
    theme: null,
    description: null,
    place: { kind: "existing", placeId },
    hostIds,
    startsAt: new Date(Date.now() + 10 * DAY),
    endsAt: null,
  });
  return id;
}

beforeAll(async () => {
  admin = await createUser("Admin C");
  mads = await createUser("Mads C");
  anders = await createUser("Anders C");
  bo = await createUser("Bo C");
  former = await createUser("Tidligere C");
  outsider = await createUser("Nabo C");
  clubId = await createClub(admin, "C-klubben");
  for (const user of [mads, anders, bo, former]) await addMember(clubId, user);
  otherClubId = await createClub(outsider, "Naboklubben C");

  hosMads = await createPlace(clubId, mads, "Hos Mads", {
    address: "Søndergade 12, 8381 Tilst",
    ownerIds: [mads.id],
  });
  hosMadsOgAnders = await createPlace(clubId, mads, "Hos Mads & Anders", {
    ownerIds: [mads.id, anders.id],
  });
  baren = await createPlace(clubId, admin, "Den lokale bar");
  klubhuset = await createPlace(clubId, admin, "Det gamle klubhus", { archived: true });
  naboensSted = await createPlace(otherClubId, outsider, "Naboens sted");
});

beforeEach(() => setActor(null));

describe("createEventAction: steder (D-099)", () => {
  it("et eksisterende sted uden valgte værter → stedets ejere er værter", async () => {
    const eventId = await createVia(bo, { placeId: hosMadsOgAnders });
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.placeId).toBe(hosMadsOgAnders);
    expect(await hostIdsOf(eventId)).toEqual(sorted([mads.id, anders.id]));
  });

  it("et sted uden ejere → opretteren er vært", async () => {
    const eventId = await createVia(bo, { placeId: baren });
    expect(await hostIdsOf(eventId)).toEqual([bo.id]);
  });

  it("'＋ Nyt sted' med adresse og 'Det er mit sted' → stedet oprettes, og jeg er ejer og vært", async () => {
    const eventId = await createVia(bo, {
      placeId: "new",
      newPlaceName: "  Hos   Bo ",
      newPlaceAddress: " Bogade 1,  8000 Aarhus ",
      newPlaceMine: "on",
    });
    const event = await db.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { place: { select: { id: true, name: true, address: true, clubId: true } } },
    });
    expect(event.place).toMatchObject({
      name: "Hos Bo",
      address: "Bogade 1, 8000 Aarhus",
      clubId,
    });
    const owners = await db.placeOwner.findMany({ where: { placeId: event.place.id } });
    expect(owners.map((owner) => owner.userId)).toEqual([bo.id]);
    expect(await hostIdsOf(eventId)).toEqual([bo.id]);
  });

  it("et nyt navn, der findes (E29), genbruger det aktive sted – også med andre mellemrum og store bogstaver", async () => {
    const before = await db.place.count({ where: { clubId } });
    const eventId = await createVia(anders, { placeId: "new", newPlaceName: " hos  MADS " });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).placeId).toBe(hosMads);
    expect(await db.place.count({ where: { clubId } })).toBe(before);
    // The reused place's owners host it (the default).
    expect(await hostIdsOf(eventId)).toEqual([mads.id]);
  });

  it("et nyt navn, der kun findes arkiveret, opretter et nyt aktivt sted", async () => {
    const eventId = await createVia(anders, {
      placeId: "new",
      newPlaceName: "Det gamle klubhus",
    });
    const { placeId } = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(placeId).not.toBe(klubhuset);
    const place = await db.place.findUniqueOrThrow({ where: { id: placeId } });
    expect(place.archivedAt).toBeNull();
    // Archive it again, so the other tests see one archived "Det gamle klubhus".
    await db.place.update({ where: { id: placeId }, data: { archivedAt: new Date() } });
  });

  it("de nye steds felter ignoreres, når et eksisterende sted er valgt", async () => {
    const before = await db.place.count({ where: { clubId } });
    const eventId = await createVia(bo, {
      placeId: baren,
      newPlaceName: "Skrevet og fortrudt",
      newPlaceAddress: "x".repeat(250),
      newPlaceMine: "on",
    });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).placeId).toBe(baren);
    expect(await db.place.count({ where: { clubId } })).toBe(before);
  });

  it("afviser et arkiveret, et ukendt og en anden klubs sted som feltfejl – uden at skrive", async () => {
    const before = await db.event.count({ where: { clubId } });
    setActor(bo);
    for (const [placeId, message] of [
      [klubhuset, PLACE_ARCHIVED],
      [UNKNOWN_ID, PLACE_GONE],
      // Another club's place: the same message as an unknown one (no leak, E22).
      [naboensSted, PLACE_GONE],
    ] as const) {
      const state = await createEventAction(
        null,
        formData(fields({ placeId, hostIds: [mads.id] })),
      );
      expect(state?.error.code).toBe(ACTION_ERROR_CODES.VALIDATION);
      expect(state?.error.fieldErrors).toEqual({ placeId: [message] });
      // The echo keeps the choice, so the form shows what was sent (F-053).
      expect(state?.values).toMatchObject({ placeId, hostIds: [mads.id] });
    }
    expect(await db.event.count({ where: { clubId } })).toBe(before);
  });

  it("validerer placeId: mangler, er noget sludder eller er for langt", async () => {
    setActor(bo);
    const message = async (placeId: string) =>
      (await createEventAction(null, formData(fields({ placeId }))))?.error.fieldErrors?.placeId;
    expect(await message("")).toEqual(["Vælg et sted, eller opret et nyt."]);
    expect(await message("hos-mads")).toEqual(["Vælg et sted fra listen."]);
    expect(await message("x".repeat(65))).toEqual(["Vælg et sted fra listen."]);
    expect(
      (await createEventAction(null, formData(fields({ placeId: "new" }))))?.error.fieldErrors,
    ).toEqual({ newPlaceName: ["Giv stedet et navn."] });
  });
});

describe("createEventAction: værter (D-098)", () => {
  it("valgte værter vinder over stedets ejere, og dubletter fjernes", async () => {
    const eventId = await createVia(bo, {
      placeId: hosMads,
      hostIds: [anders.id, bo.id, anders.id],
    });
    expect(await hostIdsOf(eventId)).toEqual(sorted([anders.id, bo.id]));
  });

  it("en vært uden for klubben er en feltfejl, og intet skrives", async () => {
    const before = await db.event.count({ where: { clubId } });
    setActor(bo);
    const state = await createEventAction(
      null,
      formData(fields({ placeId: baren, hostIds: [mads.id, outsider.id] })),
    );
    expect(state?.error.fieldErrors).toEqual({ hostIds: [INVALID_HOSTS] });
    expect(await db.event.count({ where: { clubId } })).toBe(before);
  });

  it("validerer listen: 21 værter og et ugyldigt id", async () => {
    setActor(bo);
    const tooMany = Array.from(
      { length: 21 },
      (_, index) => `0199a000-0000-7000-8000-${String(index).padStart(12, "0")}`,
    );
    expect(
      (await createEventAction(null, formData(fields({ placeId: baren, hostIds: tooMany }))))?.error
        .fieldErrors?.hostIds,
    ).toEqual(["Der kan højst være 20 værter."]);
    expect(
      (await createEventAction(null, formData(fields({ placeId: baren, hostIds: ["mads"] }))))
        ?.error.fieldErrors?.hostIds,
    ).toEqual(["Vælg værter fra listen."]);
  });

  it("giver en ikke-medlem og et ugyldigt klub-id en 404", async () => {
    setActor(outsider);
    await expectNotFound(createEventAction(null, formData(fields({ placeId: baren }))));
    await expectNotFound(
      createEventAction(null, formData({ ...fields({ placeId: baren }), clubId: "x" })),
    );
  });
});

describe("updateEventAction og deleteEventAction: opretter, vært eller admin (D-098)", () => {
  it("en vært, der ikke oprettede eventet, må rette og slette det", async () => {
    const eventId = await insertEvent(mads, hosMads, [anders.id]);
    setActor(anders);
    await expectRedirect(
      updateEventAction(
        null,
        formData({ ...fields({ placeId: hosMads, hostIds: [anders.id] }), eventId }),
      ),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    await expectRedirect(deleteEventAction(clubId, eventId), `/c/${clubId}?toast=event-deleted`);
    expect(await db.event.findUnique({ where: { id: eventId } })).toBeNull();
  });

  it("et medlem, der hverken er opretter eller vært, afvises med den nye tekst", async () => {
    const eventId = await insertEvent(mads, hosMads, [mads.id]);
    setActor(bo);
    const state = await updateEventAction(
      null,
      formData({ ...fields({ placeId: hosMads, title: "Overtaget" }), eventId }),
    );
    expect(state?.error).toMatchObject({
      code: ACTION_ERROR_CODES.FORBIDDEN,
      message: NOT_ALLOWED_TO_EDIT,
    });
    expect(await deleteEventAction(clubId, eventId)).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN, message: NOT_ALLOWED_TO_DELETE },
    });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).title).toBe(
      "Itest-smagning",
    );
  });

  it("et event på et nu arkiveret sted kan rettes og beholder stedet (E30), men et andet arkiveret sted afvises", async () => {
    const placeId = await createPlace(clubId, admin, "Snart arkiveret");
    const eventId = await insertEvent(admin, placeId, []);
    await db.place.update({ where: { id: placeId }, data: { archivedAt: new Date() } });

    setActor(admin);
    await expectRedirect(
      updateEventAction(null, formData({ ...fields({ placeId, title: "Rettet" }), eventId })),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event).toMatchObject({ placeId, title: "Rettet" });

    const state = await updateEventAction(
      null,
      formData({ ...fields({ placeId: klubhuset }), eventId }),
    );
    expect(state?.error.fieldErrors).toEqual({ placeId: [PLACE_ARCHIVED] });
  });

  it("en vært, der har forladt klubben, må blive (E31), men ikke tilføjes igen", async () => {
    const eventId = await insertEvent(admin, baren, [former.id, bo.id]);
    const otherEventId = await insertEvent(admin, baren, [bo.id]);
    await db.membership.deleteMany({ where: { clubId, userId: former.id } });
    try {
      setActor(admin);
      await expectRedirect(
        updateEventAction(
          null,
          formData({ ...fields({ placeId: baren, hostIds: [former.id, bo.id] }), eventId }),
        ),
        `/c/${clubId}/events/${eventId}?toast=event-updated`,
      );
      expect(await hostIdsOf(eventId)).toEqual(sorted([former.id, bo.id]));

      const state = await updateEventAction(
        null,
        formData({
          ...fields({ placeId: baren, hostIds: [former.id, bo.id] }),
          eventId: otherEventId,
        }),
      );
      expect(state?.error.fieldErrors).toEqual({ hostIds: [INVALID_HOSTS] });
      expect(await hostIdsOf(otherEventId)).toEqual([bo.id]);
    } finally {
      await addMember(clubId, former);
    }
  });

  it("ingen valgte værter ved redigering → stedets ejere, ellers eventets opretter", async () => {
    const eventId = await insertEvent(bo, baren, [anders.id]);
    setActor(admin);
    await expectRedirect(
      updateEventAction(null, formData({ ...fields({ placeId: hosMads }), eventId })),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    expect(await hostIdsOf(eventId)).toEqual([mads.id]);
    await expectRedirect(
      updateEventAction(null, formData({ ...fields({ placeId: baren }), eventId })),
      `/c/${clubId}/events/${eventId}?toast=event-updated`,
    );
    expect(await hostIdsOf(eventId)).toEqual([bo.id]);
  });

  it("en anden klubs event og et ugyldigt event-id giver 404", async () => {
    const { id: foreignEventId } = await createEvent({
      clubId: otherClubId,
      createdById: outsider.id,
      title: "Nabosmagning",
      theme: null,
      description: null,
      place: { kind: "existing", placeId: naboensSted },
      hostIds: [],
      startsAt: new Date(Date.now() + 3 * DAY),
      endsAt: null,
    });
    setActor(admin);
    await expectNotFound(
      updateEventAction(null, formData({ ...fields({ placeId: baren }), eventId: foreignEventId })),
    );
    await expectNotFound(
      updateEventAction(null, formData({ ...fields({ placeId: baren }), eventId: "x" })),
    );
    await expectNotFound(deleteEventAction(clubId, foreignEventId));
  });
});

describe("?placeId= (Opret event her) og stedvalgets standard", () => {
  it("vælger kun et aktivt sted i klubben på forhånd", async () => {
    const places = toPlaceChoices(await listPlaceOptions(clubId));
    expect(places.some((place) => place.id === klubhuset)).toBe(false);
    expect(places.some((place) => place.id === naboensSted)).toBe(false);
    expect(initialPlaceId({ places, prefillPlaceId: hosMads })).toBe(hosMads);
    expect(initialPlaceId({ places, prefillPlaceId: klubhuset })).toBe("");
    expect(initialPlaceId({ places, prefillPlaceId: naboensSted })).toBe("");
    expect(initialPlaceId({ places, prefillPlaceId: "x" })).toBe("");
  });

  it("tilbyder eventets arkiverede sted ved redigering og vælger det", async () => {
    const places = toPlaceChoices(await listPlaceOptions(clubId, { includePlaceId: klubhuset }));
    expect(places.find((place) => place.id === klubhuset)?.archived).toBe(true);
    expect(initialPlaceId({ places, currentPlaceId: klubhuset })).toBe(klubhuset);
  });

  it("åbner '＋ Nyt sted' i en klub uden steder", async () => {
    expect(initialPlaceId({ places: toPlaceChoices(await listPlaceOptions(otherClubId)) })).toBe(
      naboensSted,
    );
    const emptyClubId = await createClub(outsider, "Tom klub C");
    expect(initialPlaceId({ places: toPlaceChoices(await listPlaceOptions(emptyClubId)) })).toBe(
      "new",
    );
  });
});
