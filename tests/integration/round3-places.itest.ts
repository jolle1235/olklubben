import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import {
  createPlaceAction,
  removePlaceAction,
  removePlaceOwnerAction,
  restorePlaceAction,
  setOwnPlaceOwnershipAction,
  updatePlaceAction,
} from "@/server/actions/places";
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
 * The places Server Actions (SPEC §9.4, §5.1, D-095, D-100) against the real
 * database: name uniqueness (PLACE_NAME_TAKEN with the existing place), the
 * self-only owner toggle, admins removing other owners, the one removal action
 * (unused → deleted, used → archived) with its permissions and toast keys,
 * restore with a name clash, and club isolation (non-member, another club's
 * place or a malformed id → 404, §4.4). These calls are what a forged request
 * would do; hidden buttons are only UX.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";
const DAY = 24 * 60 * 60 * 1000;

let admin: TestUser;
let member: TestUser;
let owner: TestUser;
let outsider: TestUser;
let clubId: string;
let otherClubId: string;
let otherPlaceId: string;
let counter = 0;

/** A name no other test uses (the club's active names must be unique). */
function uniqueName(label = "Sted"): string {
  counter += 1;
  return `${label} ${counter}`;
}

const createFields = (overrides: Record<string, string> = {}) => ({
  clubId,
  name: uniqueName(),
  address: "",
  description: "",
  ...overrides,
});

async function placeRow(placeId: string) {
  return db.place.findUnique({
    where: { id: placeId },
    select: { name: true, nameKey: true, address: true, description: true, archivedAt: true },
  });
}

async function ownerIds(placeId: string): Promise<string[]> {
  const rows = await db.placeOwner.findMany({ where: { placeId }, select: { userId: true } });
  return rows.map((row) => row.userId).sort();
}

/** An event at the place, so it counts as used (§9.4). */
async function eventAt(placeId: string, by: TestUser = admin): Promise<string> {
  const { id } = await createEvent({
    clubId,
    createdById: by.id,
    title: "Itest-smagning",
    theme: null,
    description: null,
    place: { kind: "existing", placeId },
    hostIds: [],
    startsAt: new Date(Date.now() - 3 * DAY),
    endsAt: null,
  });
  return id;
}

function idFrom(url: string): string {
  return url.split("?")[0]?.split("/").pop() ?? "";
}

beforeAll(async () => {
  admin = await createUser("Admin Steder");
  member = await createUser("Medlem Steder");
  owner = await createUser("Ejer Steder");
  outsider = await createUser("Nabo Steder");
  clubId = await createClub(admin, "Steder-klubben");
  await addMember(clubId, member);
  await addMember(clubId, owner);
  otherClubId = await createClub(outsider, "Naboklubben");
  otherPlaceId = await createPlace(otherClubId, outsider, "Hos naboen", {
    ownerIds: [outsider.id],
  });
});

beforeEach(() => setActor(null));

describe("createPlaceAction", () => {
  it("creates the place, cleaned, with the creator as owner, and opens it with a toast", async () => {
    setActor(member);
    const url = await expectRedirect(
      createPlaceAction(
        null,
        formData(
          createFields({
            name: "  Hos\u0000   Bo  ",
            address: " Søndergade  12,\r\n 8381 Tilst ",
            description: "Ring på\r\nbagdøren",
            makeMeOwner: "on",
          }),
        ),
      ),
      new RegExp(`^/c/${clubId}/places/${UUID}\\?toast=place-created$`),
    );
    const placeId = idFrom(url);
    expect(await placeRow(placeId)).toMatchObject({
      name: "Hos Bo",
      nameKey: "hosbo",
      address: "Søndergade 12, 8381 Tilst",
      description: "Ring på\nbagdøren",
      archivedAt: null,
    });
    expect(await ownerIds(placeId)).toEqual([member.id]);
  });

  it("creates it without owners unless 'Det er mit sted' is ticked", async () => {
    setActor(member);
    const url = await expectRedirect(
      createPlaceAction(null, formData(createFields())),
      /toast=place-created/,
    );
    expect(await ownerIds(idFrom(url))).toEqual([]);
  });

  it("returns field errors and echoes what was typed", async () => {
    setActor(member);
    const empty = await createPlaceAction(null, formData(createFields({ name: "   " })));
    expect(empty).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.VALIDATION,
        fieldErrors: { name: ["Giv stedet et navn."] },
      },
      values: { name: "   " },
    });

    const tooLong = await createPlaceAction(
      null,
      formData(createFields({ name: "x".repeat(121), address: "a".repeat(201) })),
    );
    expect(tooLong?.error.fieldErrors).toEqual({
      name: ["Navnet må højst være 120 tegn."],
      address: ["Adressen må højst være 200 tegn."],
    });
    expect(tooLong?.values.name).toHaveLength(121);
  });

  it("refuses a name an ACTIVE place has (case and spaces aside) and returns that place", async () => {
    const existingId = await createPlace(clubId, admin, "Hos Dublet");
    setActor(member);
    const before = await db.place.count({ where: { clubId } });
    const state = await createPlaceAction(null, formData(createFields({ name: " hos   DUBLET " })));
    expect(state).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.PLACE_NAME_TAKEN,
        message: "Der findes allerede et sted, der hedder «Hos Dublet».",
        fieldErrors: { name: ["Der findes allerede et sted, der hedder «Hos Dublet»."] },
      },
      existing: { id: existingId, name: "Hos Dublet" },
      values: { name: " hos   DUBLET " },
    });
    expect(await db.place.count({ where: { clubId } })).toBe(before);
  });

  it("allows the name of an ARCHIVED place", async () => {
    await createPlace(clubId, admin, "Hos Gammel", { archived: true });
    setActor(member);
    await expectRedirect(
      createPlaceAction(null, formData(createFields({ name: "Hos Gammel" }))),
      /toast=place-created/,
    );
  });

  it("gives 404 to a non-member and for a malformed club id, and sends a guest to /login", async () => {
    setActor(outsider);
    await expectNotFound(createPlaceAction(null, formData(createFields())));
    setActor(member);
    await expectNotFound(createPlaceAction(null, formData(createFields({ clubId: "ikke-et-id" }))));
    setActor(null);
    await expectRedirect(createPlaceAction(null, formData(createFields())), /^\/login/);
  });
});

describe("updatePlaceAction", () => {
  it("lets any member edit name, address and description, archived places too", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName("Hos Rettes"), { archived: true });
    setActor(member);
    await expectRedirect(
      updatePlaceAction(
        null,
        formData({
          clubId,
          placeId,
          name: "Hos  Rettet",
          address: "Vej 1",
          description: "  ",
        }),
      ),
      `/c/${clubId}/places/${placeId}?toast=place-updated`,
    );
    expect(await placeRow(placeId)).toMatchObject({
      name: "Hos Rettet",
      nameKey: "hosrettet",
      address: "Vej 1",
      description: null,
    });
  });

  it("keeps the place's own name in another spelling, but refuses another active place's", async () => {
    const takenId = await createPlace(clubId, admin, "Hos Optaget");
    const placeId = await createPlace(clubId, admin, "Hos Fri");
    setActor(member);
    await expectRedirect(
      updatePlaceAction(null, formData({ clubId, placeId, name: "HOS FRI" })),
      /toast=place-updated/,
    );
    const state = await updatePlaceAction(null, formData({ clubId, placeId, name: "hos optaget" }));
    expect(state).toMatchObject({
      error: {
        code: ACTION_ERROR_CODES.PLACE_NAME_TAKEN,
        fieldErrors: { name: [expect.any(String)] },
      },
      existing: { id: takenId, name: "Hos Optaget" },
    });
    expect((await placeRow(placeId))?.name).toBe("HOS FRI");
  });

  it("gives 404 for another club's place, an unknown or malformed id, and a non-member", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName());
    setActor(member);
    for (const id of [otherPlaceId, UNKNOWN_ID, "123"]) {
      await expectNotFound(
        updatePlaceAction(null, formData({ clubId, placeId: id, name: "Hijack" })),
      );
    }
    setActor(outsider);
    await expectNotFound(updatePlaceAction(null, formData({ clubId, placeId, name: "Hijack" })));
    await expectNotFound(
      updatePlaceAction(null, formData({ clubId: otherClubId, placeId, name: "Hijack" })),
    );
    expect((await placeRow(otherPlaceId))?.name).toBe("Hos naboen");
  });
});

describe("setOwnPlaceOwnershipAction", () => {
  it("sets the caller's own ownership to the desired state, idempotently", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName());
    setActor(member);
    for (let i = 0; i < 2; i += 1) {
      expect(await setOwnPlaceOwnershipAction(clubId, placeId, true)).toEqual({
        ok: true,
        data: { isOwner: true },
      });
    }
    expect(await ownerIds(placeId)).toEqual([member.id]);
    for (let i = 0; i < 2; i += 1) {
      expect(await setOwnPlaceOwnershipAction(clubId, placeId, false)).toEqual({
        ok: true,
        data: { isOwner: false },
      });
    }
    expect(await ownerIds(placeId)).toEqual([]);
  });

  it("never touches anyone else's ownership", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName(), { ownerIds: [owner.id] });
    setActor(member);
    // A forged extra argument (another user's id) is simply not part of the action.
    const forged = setOwnPlaceOwnershipAction as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;
    await forged(clubId, placeId, false, owner.id);
    expect(await ownerIds(placeId)).toEqual([owner.id]);
  });

  it("refuses a desired state that is not a boolean", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName());
    setActor(member);
    const state = await setOwnPlaceOwnershipAction(clubId, placeId, "true" as unknown as boolean);
    expect(state).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.VALIDATION } });
    expect(await ownerIds(placeId)).toEqual([]);
  });

  it("gives 404 for another club's place, a malformed id and a non-member", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName());
    setActor(member);
    await expectNotFound(setOwnPlaceOwnershipAction(clubId, otherPlaceId, true));
    await expectNotFound(setOwnPlaceOwnershipAction(otherClubId, otherPlaceId, true));
    await expectNotFound(setOwnPlaceOwnershipAction(clubId, "123", true));
    setActor(outsider);
    await expectNotFound(setOwnPlaceOwnershipAction(clubId, placeId, true));
    expect(await ownerIds(otherPlaceId)).toEqual([outsider.id]);
    expect(await ownerIds(placeId)).toEqual([]);
  });
});

describe("removePlaceOwnerAction", () => {
  it("lets an admin remove another owner", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName(), {
      ownerIds: [owner.id, member.id],
    });
    setActor(admin);
    expect(await removePlaceOwnerAction(clubId, placeId, owner.id)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await ownerIds(placeId)).toEqual([member.id]);
  });

  it("refuses a member removing someone else, but lets them remove themself", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName(), {
      ownerIds: [owner.id, member.id],
    });
    setActor(member);
    expect(await removePlaceOwnerAction(clubId, placeId, owner.id)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Kun klubbens admins kan fjerne andre som ejere.",
      },
    });
    expect(await removePlaceOwnerAction(clubId, placeId, member.id)).toMatchObject({ ok: true });
    expect(await ownerIds(placeId)).toEqual([owner.id]);
  });

  it("is a no-op for someone who is not an owner, and 404s for foreign or malformed ids", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName(), { ownerIds: [owner.id] });
    setActor(admin);
    expect(await removePlaceOwnerAction(clubId, placeId, outsider.id)).toMatchObject({
      ok: true,
    });
    await expectNotFound(removePlaceOwnerAction(clubId, otherPlaceId, outsider.id));
    await expectNotFound(removePlaceOwnerAction(clubId, placeId, "ikke-et-id"));
    expect(await ownerIds(otherPlaceId)).toEqual([outsider.id]);
    expect(await ownerIds(placeId)).toEqual([owner.id]);
  });
});

describe("removePlaceAction", () => {
  it("deletes an unused place for its creator and opens Steder with a toast", async () => {
    const placeId = await createPlace(clubId, member, uniqueName());
    setActor(member);
    await expectRedirect(
      removePlaceAction(clubId, placeId),
      `/c/${clubId}/places?toast=place-deleted`,
    );
    expect(await placeRow(placeId)).toBeNull();
  });

  it("refuses a member who is neither owner, creator nor admin", async () => {
    const unused = await createPlace(clubId, admin, uniqueName());
    const used = await createPlace(clubId, admin, uniqueName());
    await eventAt(used);
    setActor(member);
    expect(await removePlaceAction(clubId, unused)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Kun stedets ejere, opretteren og klubbens admins kan slette det.",
      },
    });
    expect(await removePlaceAction(clubId, used)).toMatchObject({
      error: { message: "Kun stedets ejere og klubbens admins kan arkivere det." },
    });
    expect(await placeRow(unused)).not.toBeNull();
    expect((await placeRow(used))?.archivedAt).toBeNull();
  });

  it("does not let the creator archive a used place (only owners and admins)", async () => {
    const placeId = await createPlace(clubId, member, uniqueName());
    await eventAt(placeId);
    setActor(member);
    expect(await removePlaceAction(clubId, placeId)).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN },
    });
    expect((await placeRow(placeId))?.archivedAt).toBeNull();
  });

  it("archives a used place for an owner or an admin; its events keep it", async () => {
    for (const actor of [owner, admin]) {
      const placeId = await createPlace(clubId, admin, uniqueName(), { ownerIds: [owner.id] });
      const eventId = await eventAt(placeId);
      setActor(actor);
      await expectRedirect(
        removePlaceAction(clubId, placeId),
        `/c/${clubId}/places/${placeId}?toast=place-archived`,
      );
      expect((await placeRow(placeId))?.archivedAt).toBeInstanceOf(Date);
      expect(
        await db.event.findUnique({ where: { id: eventId }, select: { placeId: true } }),
      ).toEqual({ placeId });
    }
  });

  it("answers an already archived place with its page, and 404s for foreign or malformed ids", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName(), { archived: true });
    setActor(admin);
    await expectRedirect(
      removePlaceAction(clubId, placeId),
      `/c/${clubId}/places/${placeId}?toast=place-archived`,
    );
    expect(await placeRow(placeId)).not.toBeNull();
    await expectNotFound(removePlaceAction(clubId, otherPlaceId));
    await expectNotFound(removePlaceAction(otherClubId, otherPlaceId));
    await expectNotFound(removePlaceAction(clubId, "123"));
    expect(await placeRow(otherPlaceId)).not.toBeNull();
  });
});

describe("restorePlaceAction", () => {
  it("lets an owner restore an archived place, with a toast", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName(), {
      archived: true,
      ownerIds: [owner.id],
    });
    setActor(owner);
    await expectRedirect(
      restorePlaceAction(clubId, placeId),
      `/c/${clubId}/places/${placeId}?toast=place-restored`,
    );
    expect((await placeRow(placeId))?.archivedAt).toBeNull();
  });

  it("refuses a plain member", async () => {
    const placeId = await createPlace(clubId, member, uniqueName(), { archived: true });
    setActor(member);
    expect(await restorePlaceAction(clubId, placeId)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Kun stedets ejere og klubbens admins kan gendanne det.",
      },
    });
    expect((await placeRow(placeId))?.archivedAt).toBeInstanceOf(Date);
  });

  it("refuses when an active place has taken the name, and points at it", async () => {
    const archivedId = await createPlace(clubId, admin, "Hos Klubhuset", { archived: true });
    const activeId = await createPlace(clubId, admin, "HOS KLUBHUSET");
    setActor(admin);
    expect(await restorePlaceAction(clubId, archivedId)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.PLACE_NAME_TAKEN,
        message: "Der findes allerede et aktivt sted, der hedder «HOS KLUBHUSET».",
      },
      existing: { id: activeId, name: "HOS KLUBHUSET" },
    });
    expect((await placeRow(archivedId))?.archivedAt).toBeInstanceOf(Date);
  });

  it("just opens an active place, and 404s for foreign or malformed ids", async () => {
    const placeId = await createPlace(clubId, admin, uniqueName());
    setActor(admin);
    await expectRedirect(restorePlaceAction(clubId, placeId), `/c/${clubId}/places/${placeId}`);
    await expectNotFound(restorePlaceAction(clubId, otherPlaceId));
    await expectNotFound(restorePlaceAction(clubId, "123"));
    setActor(outsider);
    await expectNotFound(restorePlaceAction(clubId, placeId));
  });
});
