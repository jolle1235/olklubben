import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { isAPIError } from "better-auth/api";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { revokePasswordResetTokens } from "@/server/auth/reset-link";
import { createBeer, setRating } from "@/server/beers/mutations";
import {
  changeMemberRole,
  ClubGoneError,
  deleteClub,
  leaveClub,
  removeMember,
  updateClubInfo,
} from "@/server/clubs/membership";
import { createClubWithAdmin } from "@/server/clubs/mutations";
import { findClubMember, getClubContentCounts, listMemberOptions } from "@/server/clubs/queries";
import { db } from "@/server/db";
import type { ClubRole } from "@/server/domain/clubs/permissions";
import { placeNameKey } from "@/server/domain/places/name";
import {
  createEvent,
  InvalidEventHostsError,
  PlaceNotSelectableError,
  updateEvent,
  type EventPlaceChoice,
} from "@/server/events/mutations";
import {
  countPastEvents,
  getEvent,
  listEventsAtPlace,
  listPastEvents,
  listUpcomingEvents,
} from "@/server/events/queries";
import {
  createPlace as createPlaceTx,
  PlaceNameTakenError,
  removePlace,
  restorePlace,
  setPlaceOwnership,
  updatePlace,
} from "@/server/places/mutations";
import { getPlace, getPlaceUsage, listPlaceOptions, listPlaces } from "@/server/places/queries";
import { revokeOtherSessions, updateUserProfile } from "@/server/users/mutations";
import { getAccountLogins, listUserClubIds } from "@/server/users/queries";

import { addGoogleAccount, createClub, createPlace, createUser, type TestUser } from "./helpers";

/**
 * Round 3's data layer against the real database (SPEC §7.4, §9.2, §9.4, §9.8;
 * D-095–D-105): the composite FKs and CHECKs as backstops, the lock-based
 * invariants under real concurrency (Promise.all, repeated), membership
 * endings, deleting a club, places and hosts on events, the nickname in
 * Better Auth and the history queries.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LOOPS = 12;

/** Starts `run` 0–5 ms late, so a race loop hits both orderings (not just the faster call first). */
async function staggered<T>(round: number, run: () => Promise<T>): Promise<T> {
  await sleep(round % 6);
  return run();
}

type Person = { id: string; name: string };

/** A user written directly (no password, no session): fast for concurrency loops. */
async function person(name: string): Promise<Person> {
  return db.user.create({
    data: { name, email: `r3data-${randomUUID()}@example.test` },
    select: { id: true, name: true },
  });
}

async function clubWith(
  admin: Person,
  members: [Person, ClubRole][] = [],
  name = "R3-klub",
): Promise<string> {
  const { clubId } = await createClubWithAdmin({ userId: admin.id, name });
  for (const [member, role] of members) {
    await db.membership.create({ data: { clubId, userId: member.id, role } });
  }
  return clubId;
}

async function place(
  clubId: string,
  creator: Person,
  name: string,
  options: { ownerIds?: string[]; archived?: boolean; address?: string | null } = {},
): Promise<string> {
  return createPlace(clubId, { ...creator, email: "", cookie: "" }, name, options);
}

const existing = (placeId: string): EventPlaceChoice => ({ kind: "existing", placeId });
const newPlace = (name: string, ownedByCreator = false): EventPlaceChoice => ({
  kind: "new",
  name,
  address: null,
  ownedByCreator,
});

function eventInput(
  clubId: string,
  createdById: string,
  placeChoice: EventPlaceChoice,
  options: { title?: string; startsAt?: Date; endsAt?: Date | null; hostIds?: string[] } = {},
) {
  return {
    clubId,
    createdById,
    title: options.title ?? "Smagning",
    theme: null,
    description: null,
    startsAt: options.startsAt ?? new Date(Date.now() + 7 * DAY),
    endsAt: options.endsAt ?? null,
    place: placeChoice,
    hostIds: options.hostIds ?? [],
  };
}

async function hostIdsOf(eventId: string): Promise<string[]> {
  const hosts = await db.eventHost.findMany({ where: { eventId }, select: { userId: true } });
  return hosts.map((host) => host.userId).sort();
}

async function adminCountOf(clubId: string): Promise<number> {
  return db.membership.count({ where: { clubId, role: "ADMIN" } });
}

async function settle<T>(
  promise: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

// ── DB backstops (D-095, D-096, CHECKs) ──────────────────────────────────────

describe("databasens garantier (D-095, D-096)", () => {
  let admin: Person;
  let outsider: Person;
  let clubId: string;
  let otherClubId: string;

  beforeAll(async () => {
    admin = await person("Backstop Admin");
    outsider = await person("Backstop Nabo");
    clubId = await clubWith(admin);
    otherClubId = await clubWith(outsider);
  });

  it("afviser et event på en anden klubs sted (sammensat FK)", async () => {
    const foreignPlace = await place(otherClubId, outsider, "Naboens sted");
    await expect(
      db.event.create({
        data: {
          clubId,
          placeId: foreignPlace,
          createdById: admin.id,
          title: "Snyd",
          startsAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    expect(await db.event.count({ where: { clubId, title: "Snyd" } })).toBe(0);
  });

  it("afviser en stedejer, der ikke er medlem af klubben (sammensat FK)", async () => {
    const placeId = await place(clubId, admin, "Kun medlemmer");
    await expect(
      db.placeOwner.create({ data: { placeId, clubId, userId: outsider.id } }),
    ).rejects.toThrow();
    // Also not through the other club's id: the place is not in that club.
    await expect(
      db.placeOwner.create({ data: { placeId, clubId: otherClubId, userId: outsider.id } }),
    ).rejects.toThrow();
  });

  it("tillader kun ét aktivt sted pr. navn, men et arkiveret må hedde det samme", async () => {
    const first = await place(clubId, admin, "Hos Backstop");
    await expect(place(clubId, admin, " hos  BACKSTOP ")).rejects.toThrow(
      /Unique constraint|places_club_id_name_key_active_key/,
    );
    await db.place.update({ where: { id: first }, data: { archivedAt: new Date() } });
    const second = await place(clubId, admin, "HOS Backstop");
    expect(second).not.toBe(first);
    // Another club may of course have its own.
    await place(otherClubId, outsider, "Hos Backstop");
  });

  it("håndhæver længderne med CHECK-constraints", async () => {
    await expect(
      db.user.update({ where: { id: admin.id }, data: { nickname: "x".repeat(41) } }),
    ).rejects.toThrow(/users_nickname_length_check/);
    await expect(
      db.user.update({ where: { id: admin.id }, data: { nickname: "   " } }),
    ).rejects.toThrow(/users_nickname_length_check/);
    await expect(place(clubId, admin, "x".repeat(121))).rejects.toThrow(/places_name_length_check/);
    await expect(
      db.place.create({
        data: { clubId, createdById: admin.id, name: "Tom nøgle", nameKey: "" },
      }),
    ).rejects.toThrow(/places_name_key_not_empty_check/);
    await expect(
      place(clubId, admin, "Lang adresse", { address: "x".repeat(201) }),
    ).rejects.toThrow(/places_address_length_check/);
    await expect(
      db.club.update({ where: { id: clubId }, data: { description: "x".repeat(301) } }),
    ).rejects.toThrow(/clubs_description_length_check/);
    expect(
      await db.user.update({
        where: { id: admin.id },
        data: { nickname: "x".repeat(40) },
        select: { nickname: true },
      }),
    ).toEqual({ nickname: "x".repeat(40) });
  });
});

// ── Events: place and hosts (D-098, D-099, E30) ─────────────────────────────

describe("createEvent/updateEvent: sted og værter", () => {
  let admin: Person;
  let mads: Person;
  let anders: Person;
  let bo: Person;
  let outsider: Person;
  let clubId: string;
  let otherClubId: string;
  let hosMads: string;

  beforeAll(async () => {
    admin = await person("Event Admin");
    mads = await person("Event Mads");
    anders = await person("Event Anders");
    bo = await person("Event Bo");
    outsider = await person("Event Nabo");
    clubId = await clubWith(admin, [
      [mads, "MEMBER"],
      [anders, "MEMBER"],
      [bo, "MEMBER"],
    ]);
    otherClubId = await clubWith(outsider);
    hosMads = await place(clubId, mads, "Hos Mads", { ownerIds: [mads.id] });
  });

  it("gør stedets ejere til værter, når der ikke er valgt nogen", async () => {
    const { id, placeId } = await createEvent(eventInput(clubId, anders.id, existing(hosMads)));
    expect(placeId).toBe(hosMads);
    expect(await hostIdsOf(id)).toEqual([mads.id]);
  });

  it("gør opretteren til vært, når stedet ingen ejere har", async () => {
    const bar = await place(clubId, admin, "Den lokale bar");
    const { id } = await createEvent(eventInput(clubId, anders.id, existing(bar)));
    expect(await hostIdsOf(id)).toEqual([anders.id]);
  });

  it("bruger de valgte værter (uden dubletter)", async () => {
    const { id } = await createEvent(
      eventInput(clubId, anders.id, existing(hosMads), { hostIds: [bo.id, admin.id, bo.id] }),
    );
    expect(await hostIdsOf(id)).toEqual([admin.id, bo.id].sort());
  });

  it("afviser en vært uden for klubben og skriver intet, heller ikke et nyt sted", async () => {
    const events = await db.event.count({ where: { clubId } });
    const result = await settle(
      createEvent(
        eventInput(clubId, anders.id, newPlace("Rollback-stedet"), { hostIds: [outsider.id] }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InvalidEventHostsError);
      expect((result.error as InvalidEventHostsError).userIds).toEqual([outsider.id]);
    }
    expect(await db.event.count({ where: { clubId } })).toBe(events);
    expect(await db.place.count({ where: { clubId, name: "Rollback-stedet" } })).toBe(0);
  });

  it("genbruger et aktivt sted med samme navn og laver et nyt, når kun et arkiveret matcher", async () => {
    const reused = await createEvent(eventInput(clubId, bo.id, newPlace(" hos  MADS ")));
    expect(reused.placeId).toBe(hosMads);
    expect(await hostIdsOf(reused.id)).toEqual([mads.id]);

    const archived = await place(clubId, admin, "Det gamle klubhus", { archived: true });
    const fresh = await createEvent(eventInput(clubId, bo.id, newPlace("Det Gamle Klubhus")));
    expect(fresh.placeId).not.toBe(archived);
    expect(await db.place.findUniqueOrThrow({ where: { id: fresh.placeId } })).toMatchObject({
      name: "Det Gamle Klubhus",
      nameKey: placeNameKey("Det gamle klubhus"),
      archivedAt: null,
      createdById: bo.id,
    });
  });

  it("'Det er mit sted' gør opretteren til ejer, også af et genbrugt sted", async () => {
    const created = await createEvent(eventInput(clubId, bo.id, newPlace("Hos Bo", true)));
    expect(await hostIdsOf(created.id)).toEqual([bo.id]);
    const reused = await createEvent(eventInput(clubId, anders.id, newPlace("hos mads", true)));
    expect(reused.placeId).toBe(hosMads);
    expect(await hostIdsOf(reused.id)).toEqual([anders.id, mads.id].sort());
    expect(await db.placeOwner.count({ where: { placeId: hosMads, userId: anders.id } })).toBe(1);
    await db.placeOwner.deleteMany({ where: { placeId: hosMads, userId: anders.id } });
  });

  it("afviser et arkiveret sted til et nyt event, men tillader det på det event, der har det (E30)", async () => {
    const klubhus = await place(clubId, admin, "Arkiv-sted");
    const { id } = await createEvent(eventInput(clubId, admin.id, existing(klubhus)));
    await db.place.update({ where: { id: klubhus }, data: { archivedAt: new Date() } });

    const refused = await settle(createEvent(eventInput(clubId, admin.id, existing(klubhus))));
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toBeInstanceOf(PlaceNotSelectableError);
      expect((refused.error as PlaceNotSelectableError).reason).toBe("ARCHIVED");
    }

    expect(
      await updateEvent({
        ...eventInput(clubId, admin.id, existing(klubhus), { title: "Rettet" }),
        eventId: id,
        actorUserId: admin.id,
      }),
    ).toBe(true);
    expect((await getEvent(clubId, id))?.place).toMatchObject({ id: klubhus, archived: true });
  });

  it("giver NOT_FOUND for en anden klubs sted og et ukendt sted (ingen læk)", async () => {
    const foreign = await place(otherClubId, outsider, "Naboens stue");
    for (const placeId of [foreign, randomUUID()]) {
      const result = await settle(createEvent(eventInput(clubId, admin.id, existing(placeId))));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(PlaceNotSelectableError);
        expect((result.error as PlaceNotSelectableError).reason).toBe("NOT_FOUND");
      }
    }
  });

  it("beholder en vært, der har forladt klubben, men kan ikke tilføje vedkommende igen", async () => {
    const leaver = await person("Event Leaver");
    await db.membership.create({ data: { clubId, userId: leaver.id, role: "MEMBER" } });
    // A started event: the hostship stays when the member leaves (§7.4).
    const started = await createEvent(
      eventInput(clubId, admin.id, existing(hosMads), {
        hostIds: [leaver.id],
        startsAt: new Date(Date.now() - HOUR),
      }),
    );
    const other = await createEvent(eventInput(clubId, admin.id, existing(hosMads)));
    expect(await leaveClub({ clubId, userId: leaver.id, now: new Date() })).toEqual({
      ok: true,
      effect: "delete",
    });
    expect(await hostIdsOf(started.id)).toEqual([leaver.id]);

    const event = await getEvent(clubId, started.id);
    expect(event?.hosts).toEqual([expect.objectContaining({ id: leaver.id, isMember: false })]);

    expect(
      await updateEvent({
        ...eventInput(clubId, admin.id, existing(hosMads), { hostIds: [leaver.id, bo.id] }),
        eventId: started.id,
        actorUserId: admin.id,
      }),
    ).toBe(true);
    expect(await hostIdsOf(started.id)).toEqual([bo.id, leaver.id].sort());

    const refused = await settle(
      updateEvent({
        ...eventInput(clubId, admin.id, existing(hosMads), { hostIds: [leaver.id] }),
        eventId: other.id,
        actorUserId: admin.id,
      }),
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBeInstanceOf(InvalidEventHostsError);
  });

  it("falder på redigering tilbage til eventets opretter og ellers redaktøren", async () => {
    const quitter = await person("Event Quitter");
    await db.membership.create({ data: { clubId, userId: quitter.id, role: "MEMBER" } });
    const noOwners = await place(clubId, admin, "Ejerløst sted");
    const { id } = await createEvent(eventInput(clubId, quitter.id, existing(noOwners)));
    expect(await hostIdsOf(id)).toEqual([quitter.id]);

    await updateEvent({
      ...eventInput(clubId, quitter.id, existing(noOwners)),
      eventId: id,
      actorUserId: bo.id,
    });
    expect(await hostIdsOf(id)).toEqual([quitter.id]);

    await removeMember({
      clubId,
      actorUserId: admin.id,
      targetUserId: quitter.id,
      now: new Date(),
    });
    await updateEvent({
      ...eventInput(clubId, quitter.id, existing(noOwners)),
      eventId: id,
      actorUserId: bo.id,
    });
    expect(await hostIdsOf(id)).toEqual([bo.id]);
  });

  it("returnerer false for et event i en anden klub og rører det ikke", async () => {
    const foreignPlace = await place(otherClubId, outsider, "Naboens have");
    const foreign = await createEvent(eventInput(otherClubId, outsider.id, existing(foreignPlace)));
    expect(
      await updateEvent({
        ...eventInput(clubId, admin.id, existing(hosMads), { title: "Kapret" }),
        eventId: foreign.id,
        actorUserId: admin.id,
      }),
    ).toBe(false);
    expect((await getEvent(otherClubId, foreign.id))?.title).toBe("Smagning");
  });

  it("listEventsAtPlace viser stedets events, nyeste først, kun i klubben", async () => {
    const spot = await place(clubId, admin, "Listested");
    const older = await createEvent(
      eventInput(clubId, admin.id, existing(spot), {
        title: "Ældst",
        startsAt: new Date(Date.now() - 9 * DAY),
      }),
    );
    const newer = await createEvent(
      eventInput(clubId, admin.id, existing(spot), { title: "Nyest" }),
    );
    expect((await listEventsAtPlace(clubId, spot)).map((event) => event.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(await listEventsAtPlace(otherClubId, spot)).toEqual([]);
    expect(await listEventsAtPlace(clubId, "nej")).toEqual([]);
  });
});

// ── Concurrency (E25, D-098, D-100, D-102) ───────────────────────────────────

describe("samtidighed under låse", () => {
  it(`to admins nedgraderer hinanden samtidig: klubben beholder én admin (×${LOOPS})`, async () => {
    for (let round = 0; round < LOOPS; round += 1) {
      const a = await person("Admin A");
      const b = await person("Admin B");
      const clubId = await clubWith(a, [[b, "ADMIN"]]);
      const results = await Promise.all([
        changeMemberRole({ clubId, actorUserId: a.id, targetUserId: b.id, role: "MEMBER" }),
        changeMemberRole({ clubId, actorUserId: b.id, targetUserId: a.id, role: "MEMBER" }),
      ]);
      expect(results.filter((result) => result.ok && result.effect === "setRole")).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "FORBIDDEN" }]);
      expect(await adminCountOf(clubId)).toBe(1);
    }
  });

  it(`to admins fjerner deres egen admin-rolle samtidig: én får LAST_ADMIN (×${LOOPS})`, async () => {
    for (let round = 0; round < LOOPS; round += 1) {
      const a = await person("Admin A");
      const b = await person("Admin B");
      const clubId = await clubWith(a, [[b, "ADMIN"]]);
      const results = await Promise.all([
        changeMemberRole({ clubId, actorUserId: a.id, targetUserId: a.id, role: "MEMBER" }),
        changeMemberRole({ clubId, actorUserId: b.id, targetUserId: b.id, role: "MEMBER" }),
      ]);
      expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "LAST_ADMIN" }]);
      expect(await adminCountOf(clubId)).toBe(1);
    }
  });

  it(`begge admins forlader klubben samtidig: én bliver (×${LOOPS})`, async () => {
    for (let round = 0; round < LOOPS; round += 1) {
      const a = await person("Admin A");
      const b = await person("Admin B");
      const m = await person("Medlem");
      const clubId = await clubWith(a, [
        [b, "ADMIN"],
        [m, "MEMBER"],
      ]);
      const now = new Date();
      const results = await Promise.all([
        leaveClub({ clubId, userId: a.id, now }),
        leaveClub({ clubId, userId: b.id, now }),
      ]);
      expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "LAST_ADMIN" }]);
      expect(await adminCountOf(clubId)).toBe(1);
    }
  });

  it(`A fjerner B, mens B fjerner sin egen admin-rolle: altid mindst én admin (×${LOOPS})`, async () => {
    for (let round = 0; round < LOOPS; round += 1) {
      const a = await person("Admin A");
      const b = await person("Admin B");
      const clubId = await clubWith(a, [[b, "ADMIN"]]);
      await Promise.all([
        removeMember({ clubId, actorUserId: a.id, targetUserId: b.id, now: new Date() }),
        changeMemberRole({ clubId, actorUserId: b.id, targetUserId: b.id, role: "MEMBER" }),
      ]);
      expect(await adminCountOf(clubId)).toBeGreaterThanOrEqual(1);
    }
  });

  it(`removeMember(X) ‖ updateEvent med X som vært: X er aldrig vært på et kommende event bagefter (×${LOOPS})`, async () => {
    const admin = await person("Race Admin");
    const clubId = await clubWith(admin);
    const spot = await place(clubId, admin, "Racested");
    for (let round = 0; round < LOOPS; round += 1) {
      const x = await person("Race X");
      await db.membership.create({ data: { clubId, userId: x.id, role: "MEMBER" } });
      const { id: eventId } = await createEvent(eventInput(clubId, admin.id, existing(spot)));
      const [removed, updated] = await Promise.all([
        settle(
          staggered(round, () =>
            removeMember({ clubId, actorUserId: admin.id, targetUserId: x.id, now: new Date() }),
          ),
        ),
        settle(
          updateEvent({
            ...eventInput(clubId, admin.id, existing(spot), { hostIds: [x.id, admin.id] }),
            eventId,
            actorUserId: admin.id,
          }),
        ),
      ]);
      expect(removed).toEqual({ ok: true, value: { ok: true, effect: "delete" } });
      if (!updated.ok) expect(updated.error).toBeInstanceOf(InvalidEventHostsError);
      expect(await db.eventHost.count({ where: { eventId, userId: x.id } })).toBe(0);
    }
  });

  it(`removeMember(X) ‖ setPlaceOwnership(X): ingen ejerrække bagefter, aldrig en rå FK-fejl (×${LOOPS})`, async () => {
    const admin = await person("Ejer Admin");
    const clubId = await clubWith(admin);
    const spot = await place(clubId, admin, "Ejersted");
    for (let round = 0; round < LOOPS; round += 1) {
      const x = await person("Ejer X");
      await db.membership.create({ data: { clubId, userId: x.id, role: "MEMBER" } });
      const [, owned] = await Promise.all([
        staggered(round, () =>
          removeMember({ clubId, actorUserId: admin.id, targetUserId: x.id, now: new Date() }),
        ),
        setPlaceOwnership({ clubId, placeId: spot, userId: x.id, owned: true }),
      ]);
      expect(["ok", "not-found"]).toContain(owned);
      expect(await db.placeOwner.count({ where: { placeId: spot, userId: x.id } })).toBe(0);
    }
  });

  it(`removePlace ‖ createEvent på stedet: slettet + NOT_FOUND eller arkiveret + oprettet (×${LOOPS})`, async () => {
    const admin = await person("Fjern Admin");
    const clubId = await clubWith(admin);
    for (let round = 0; round < LOOPS; round += 1) {
      const spot = await place(clubId, admin, `Kortlivet sted ${round}`);
      const [removed, created] = await Promise.all([
        removePlace({ clubId, placeId: spot, actorUserId: admin.id, actorRole: "ADMIN" }),
        settle(createEvent(eventInput(clubId, admin.id, existing(spot)))),
      ]);
      if (removed.status === "deleted") {
        expect(created.ok).toBe(false);
        if (!created.ok) {
          expect(created.error).toBeInstanceOf(PlaceNotSelectableError);
          expect((created.error as PlaceNotSelectableError).reason).toBe("NOT_FOUND");
        }
      } else {
        expect(removed.status).toBe("archived");
        expect(created.ok).toBe(true);
        expect(await db.event.count({ where: { placeId: spot } })).toBe(1);
      }
    }
  });

  it(`to events med '＋ Nyt sted' samme navn samtidig: ét sted (×${LOOPS})`, async () => {
    const admin = await person("Navne Admin");
    const member = await person("Navne Medlem");
    const clubId = await clubWith(admin, [[member, "MEMBER"]]);
    for (let round = 0; round < LOOPS; round += 1) {
      const name = `Hos Samtidig ${round}`;
      const [a, b] = await Promise.all([
        createEvent(eventInput(clubId, admin.id, newPlace(name))),
        createEvent(eventInput(clubId, member.id, newPlace(` ${name.toUpperCase()} `))),
      ]);
      expect(a.placeId).toBe(b.placeId);
      expect(await db.place.count({ where: { clubId, nameKey: placeNameKey(name) } })).toBe(1);
    }
  });

  it(`createPlace med samme navn samtidig: ét sted og én PlaceNameTakenError (×${LOOPS})`, async () => {
    const admin = await person("Opret Admin");
    const clubId = await clubWith(admin);
    for (let round = 0; round < LOOPS; round += 1) {
      const input = {
        clubId,
        createdById: admin.id,
        name: `Dobbeltsted ${round}`,
        address: null,
        description: null,
        makeCreatorOwner: false,
      };
      const results = await Promise.all([
        settle(createPlaceTx(input)),
        settle(createPlaceTx(input)),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const failure = results.find((result) => !result.ok);
      expect(failure && !failure.ok && failure.error).toBeInstanceOf(PlaceNameTakenError);
    }
  });
});

// ── Ending a membership (§7.4, E1, E15) ──────────────────────────────────────

describe("når et medlemskab ophører (§7.4)", () => {
  it("fjerner ejerskaber og kommende værtskaber, beholder historikken og nulstiller aktiv klub", async () => {
    const admin = await person("Slut Admin");
    const x = await person("Slut X");
    const clubId = await clubWith(admin, [[x, "MEMBER"]]);
    const otherClubId = await clubWith(admin, [[x, "MEMBER"]], "Anden klub");
    const xPlace = await place(clubId, x, "Hos X", { ownerIds: [x.id] });
    const otherPlace = await place(otherClubId, x, "Hos X ude", { ownerIds: [x.id] });
    const future = await createEvent(eventInput(clubId, x.id, existing(xPlace)));
    const past = await createEvent(
      eventInput(clubId, x.id, existing(xPlace), { startsAt: new Date(Date.now() - 30 * DAY) }),
    );
    const elsewhere = await createEvent(eventInput(otherClubId, x.id, existing(otherPlace)));
    const beer = await createBeer({
      clubId,
      createdById: x.id,
      name: "X' øl",
      abv: 5,
      eventId: past.id,
    });
    await setRating({ clubId, beerId: beer.id, userId: x.id, value: 8 });
    await db.user.update({ where: { id: x.id }, data: { lastActiveClubId: clubId } });

    expect(await leaveClub({ clubId, userId: x.id, now: new Date() })).toEqual({
      ok: true,
      effect: "delete",
    });

    expect(await db.membership.count({ where: { clubId, userId: x.id } })).toBe(0);
    expect(await db.placeOwner.count({ where: { clubId, userId: x.id } })).toBe(0);
    expect(await hostIdsOf(future.id)).toEqual([]);
    expect(await hostIdsOf(past.id)).toEqual([x.id]);
    expect(await db.event.count({ where: { id: { in: [future.id, past.id] } } })).toBe(2);
    expect(await db.place.count({ where: { id: xPlace } })).toBe(1);
    expect(await db.beer.count({ where: { id: beer.id } })).toBe(1);
    expect(await db.beerRating.count({ where: { beerId: beer.id, userId: x.id } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: x.id } })).lastActiveClubId).toBeNull();
    // The other club is untouched.
    expect(await db.placeOwner.count({ where: { clubId: otherClubId, userId: x.id } })).toBe(1);
    expect(await hostIdsOf(elsewhere.id)).toEqual([x.id]);
  });

  it("rører ikke aktiv klub, når den peger på en anden klub", async () => {
    const admin = await person("Aktiv Admin");
    const x = await person("Aktiv X");
    const clubId = await clubWith(admin, [[x, "MEMBER"]]);
    const otherClubId = await clubWith(admin, [[x, "MEMBER"]], "Aktiv anden");
    await db.user.update({ where: { id: x.id }, data: { lastActiveClubId: otherClubId } });
    await removeMember({ clubId, actorUserId: admin.id, targetUserId: x.id, now: new Date() });
    expect((await db.user.findUniqueOrThrow({ where: { id: x.id } })).lastActiveClubId).toBe(
      otherClubId,
    );
  });

  it("afviser den sidste admin og det eneste medlem, og ClubGoneError for en slettet klub", async () => {
    const solo = await person("Solo");
    const soloClub = await clubWith(solo);
    expect(await leaveClub({ clubId: soloClub, userId: solo.id, now: new Date() })).toEqual({
      ok: false,
      reason: "ONLY_MEMBER",
    });
    const member = await person("Solo Medlem");
    await db.membership.create({ data: { clubId: soloClub, userId: member.id, role: "MEMBER" } });
    expect(await leaveClub({ clubId: soloClub, userId: solo.id, now: new Date() })).toEqual({
      ok: false,
      reason: "LAST_ADMIN",
    });
    await expect(
      leaveClub({ clubId: randomUUID(), userId: solo.id, now: new Date() }),
    ).rejects.toBeInstanceOf(ClubGoneError);
  });
});

// ── Club info and deleting the club (§7.5, D-103, D-110) ─────────────────────

describe("klubinfo og sletning af klubben", () => {
  it("lader kun en admin ændre klubinfo", async () => {
    const admin = await person("Info Admin");
    const member = await person("Info Medlem");
    const clubId = await clubWith(admin, [[member, "MEMBER"]]);
    expect(
      await updateClubInfo({ clubId, actorUserId: member.id, name: "Kapret", description: null }),
    ).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(
      await updateClubInfo({
        clubId,
        actorUserId: admin.id,
        name: "Nyt navn",
        description: "Fredag\nkl. 18",
      }),
    ).toEqual({ ok: true });
    expect(await db.club.findUniqueOrThrow({ where: { id: clubId } })).toMatchObject({
      name: "Nyt navn",
      description: "Fredag\nkl. 18",
    });
  });

  it("sletter alt i klubben, beholder brugerne og rører ikke en anden klub", async () => {
    const admin = await person("Slet Admin");
    const member = await person("Slet Medlem");
    const clubId = await clubWith(admin, [[member, "MEMBER"]], "Drengene & Bajere");
    const keepClubId = await clubWith(admin, [[member, "MEMBER"]], "Bliver");
    const owned = await place(clubId, member, "Hos Medlemmet", { ownerIds: [member.id] });
    await place(clubId, admin, "Arkiveret", { archived: true });
    const event = await createEvent(eventInput(clubId, admin.id, existing(owned)));
    const beer = await createBeer({
      clubId,
      createdById: member.id,
      name: "Slette-øl",
      abv: 6,
      eventId: event.id,
    });
    await setRating({ clubId, beerId: beer.id, userId: admin.id, value: 9 });
    const keepPlace = await place(keepClubId, member, "Bliver-sted", { ownerIds: [member.id] });
    const keepEvent = await createEvent(eventInput(keepClubId, member.id, existing(keepPlace)));
    await db.user.update({ where: { id: member.id }, data: { lastActiveClubId: clubId } });

    expect(await getClubContentCounts(clubId)).toEqual({
      members: 2,
      events: 1,
      beers: 1,
      ratings: 1,
      places: 2,
      polls: 0,
    });

    expect(
      await deleteClub({ clubId, actorUserId: member.id, confirmName: "Drengene & Bajere" }),
    ).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(await deleteClub({ clubId, actorUserId: admin.id, confirmName: "Drengene" })).toEqual({
      ok: false,
      reason: "NAME_MISMATCH",
    });
    expect(
      await deleteClub({ clubId, actorUserId: admin.id, confirmName: "  drengene &  BAJERE " }),
    ).toEqual({ ok: true });

    expect(await db.club.count({ where: { id: clubId } })).toBe(0);
    for (const count of await Promise.all([
      db.membership.count({ where: { clubId } }),
      db.place.count({ where: { clubId } }),
      db.placeOwner.count({ where: { clubId } }),
      db.event.count({ where: { clubId } }),
      db.eventHost.count({ where: { eventId: event.id } }),
      db.beer.count({ where: { clubId } }),
      db.beerRating.count({ where: { beerId: beer.id } }),
      db.invite.count({ where: { clubId } }),
    ])) {
      expect(count).toBe(0);
    }
    expect(await db.user.count({ where: { id: { in: [admin.id, member.id] } } })).toBe(2);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: member.id } })).lastActiveClubId,
    ).toBeNull();
    expect(await db.event.count({ where: { id: keepEvent.id } })).toBe(1);
    expect(await db.placeOwner.count({ where: { placeId: keepPlace } })).toBe(1);
  });
});

// ── Places (D-095, D-100) ───────────────────────────────────────────────────

describe("steder: skrivninger og forespørgsler", () => {
  let admin: Person;
  let owner: Person;
  let creator: Person;
  let member: Person;
  let outsider: Person;
  let clubId: string;
  let otherClubId: string;

  beforeAll(async () => {
    admin = await person("Sted Admin");
    owner = await person("Sted Ejer");
    creator = await person("Sted Opretter");
    member = await person("Sted Medlem");
    outsider = await person("Sted Nabo");
    clubId = await clubWith(admin, [
      [owner, "MEMBER"],
      [creator, "MEMBER"],
      [member, "MEMBER"],
    ]);
    otherClubId = await clubWith(outsider);
  });

  const input = (name: string, extra: Partial<Parameters<typeof createPlaceTx>[0]> = {}) => ({
    clubId,
    createdById: creator.id,
    name,
    address: null,
    description: null,
    makeCreatorOwner: false,
    ...extra,
  });

  it("createPlace afviser et aktivt navn og viser det eksisterende sted", async () => {
    const { id } = await createPlaceTx(input("Hos Ejeren", { makeCreatorOwner: true }));
    expect(await db.placeOwner.count({ where: { placeId: id, userId: creator.id } })).toBe(1);
    const result = await settle(createPlaceTx(input(" hos   EJEREN ")));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PlaceNameTakenError);
      expect((result.error as PlaceNameTakenError).existing).toEqual({ id, name: "Hos Ejeren" });
    }
  });

  it("updatePlace afviser et andet aktivt steds navn, men et arkiveret sted må omdøbes", async () => {
    const { id: a } = await createPlaceTx(input("Sted A"));
    const { id: b } = await createPlaceTx(input("Sted B"));
    await expect(
      updatePlace({ clubId, placeId: b, name: "sted a", address: null, description: null }),
    ).rejects.toBeInstanceOf(PlaceNameTakenError);
    // Renaming to its own name in another spelling is fine.
    expect(
      await updatePlace({
        clubId,
        placeId: a,
        name: "STED A",
        address: "Vej 1",
        description: null,
      }),
    ).toBe(true);
    await db.place.update({ where: { id: b }, data: { archivedAt: new Date() } });
    expect(
      await updatePlace({ clubId, placeId: b, name: "Sted A", address: null, description: null }),
    ).toBe(true);
    expect(
      await updatePlace({
        clubId: otherClubId,
        placeId: a,
        name: "X",
        address: null,
        description: null,
      }),
    ).toBe(false);

    // Restoring b now clashes with the active "STED A".
    await expect(restorePlace({ clubId, placeId: b })).rejects.toBeInstanceOf(PlaceNameTakenError);
    await updatePlace({ clubId, placeId: b, name: "Sted B", address: null, description: null });
    expect(await restorePlace({ clubId, placeId: b })).toBe("restored");
    expect(await restorePlace({ clubId, placeId: b })).toBe("already-active");
    expect(await restorePlace({ clubId: otherClubId, placeId: b })).toBe("not-found");
  });

  it("removePlace sletter et ubrugt sted, arkiverer et brugt og afgør rettigheden under låsen", async () => {
    const unused = await place(clubId, creator, "Ubrugt");
    expect(
      await removePlace({ clubId, placeId: unused, actorUserId: member.id, actorRole: "MEMBER" }),
    ).toEqual({ status: "forbidden" });
    expect(
      await removePlace({ clubId, placeId: unused, actorUserId: creator.id, actorRole: "MEMBER" }),
    ).toEqual({ status: "deleted" });

    const used = await place(clubId, creator, "Brugt", { ownerIds: [owner.id] });
    await createEvent(eventInput(clubId, admin.id, existing(used)));
    expect(
      await removePlace({ clubId, placeId: used, actorUserId: creator.id, actorRole: "MEMBER" }),
    ).toEqual({ status: "forbidden" });
    expect(
      await removePlace({ clubId, placeId: used, actorUserId: owner.id, actorRole: "MEMBER" }),
    ).toEqual({ status: "archived" });
    expect(
      await removePlace({ clubId, placeId: used, actorUserId: admin.id, actorRole: "ADMIN" }),
    ).toEqual({ status: "not-found" });
    expect(
      await removePlace({
        clubId: otherClubId,
        placeId: used,
        actorUserId: outsider.id,
        actorRole: "ADMIN",
      }),
    ).toEqual({ status: "not-found" });
    expect(await getPlaceUsage(clubId, used)).toEqual({
      eventCount: 1,
      pollOptionCount: 0,
      activePollCount: 0,
    });
  });

  it("setPlaceOwnership sætter den ønskede tilstand og afviser ikke-medlemmer og fremmede steder", async () => {
    const spot = await place(clubId, creator, "Ejertoggle");
    expect(await setPlaceOwnership({ clubId, placeId: spot, userId: member.id, owned: true })).toBe(
      "ok",
    );
    expect(await setPlaceOwnership({ clubId, placeId: spot, userId: member.id, owned: true })).toBe(
      "ok",
    );
    expect(await db.placeOwner.count({ where: { placeId: spot } })).toBe(1);
    expect(
      await setPlaceOwnership({ clubId, placeId: spot, userId: member.id, owned: false }),
    ).toBe("ok");
    expect(await db.placeOwner.count({ where: { placeId: spot } })).toBe(0);
    expect(
      await setPlaceOwnership({ clubId, placeId: spot, userId: outsider.id, owned: true }),
    ).toBe("not-found");
    expect(
      await setPlaceOwnership({
        clubId: otherClubId,
        placeId: spot,
        userId: outsider.id,
        owned: true,
      }),
    ).toBe("not-found");
  });

  it("getPlace, listPlaces og listPlaceOptions holder sig til klubben og sorterer", async () => {
    const options0 = new Set((await listPlaceOptions(clubId)).map((option) => option.id));
    const zulu = await place(clubId, creator, "Zulu", { ownerIds: [owner.id, admin.id] });
    const aaby = await place(clubId, creator, "Åby");
    const gammel = await place(clubId, creator, "Gammel kro", { archived: true });
    await createEvent(
      eventInput(clubId, admin.id, existing(aaby), { startsAt: new Date(Date.now() - 2 * DAY) }),
    );

    const detail = await getPlace(clubId, zulu);
    expect(detail).toMatchObject({
      name: "Zulu",
      createdById: creator.id,
      eventCount: 0,
      archivedAt: null,
    });
    expect(detail?.owners.map((o) => o.name)).toEqual(["Sted Admin", "Sted Ejer"]);
    expect(detail?.ownerIds).toEqual(detail?.owners.map((o) => o.id));
    expect(await getPlace(otherClubId, zulu)).toBeNull();
    expect(await getPlace(clubId, "nej")).toBeNull();

    const { active, archived } = await listPlaces(clubId);
    const names = active.map((p) => p.name);
    expect(names.indexOf("Zulu")).toBeLessThan(names.indexOf("Åby"));
    expect(archived.map((p) => p.id)).toContain(gammel);
    expect(active.map((p) => p.id)).not.toContain(gammel);

    const options = (await listPlaceOptions(clubId)).filter((option) => !options0.has(option.id));
    // Used places first (Åby has an event), unused ones after; archived only when included.
    expect(options.map((option) => option.id)).toEqual([aaby, zulu]);
    expect(options[1]).toMatchObject({ ownerNames: ["Sted Admin", "Sted Ejer"], archived: false });
    const withArchived = await listPlaceOptions(clubId, { includePlaceId: gammel });
    expect(withArchived.find((option) => option.id === gammel)).toMatchObject({ archived: true });
    expect((await listPlaceOptions(otherClubId)).map((option) => option.id)).not.toContain(zulu);
  });
});

// ── Members, users and Better Auth (D-105, D-106) ───────────────────────────

describe("medlemmer, brugere og Better Auth", () => {
  let jesper: TestUser;
  let clubId: string;

  beforeAll(async () => {
    jesper = await createUser("Jesper Thomsen");
    clubId = await createClub(jesper, "Kælenavneklubben");
  });

  it("Better Auth afviser kælenavnet som input (FIELD_NOT_ALLOWED)", async () => {
    const error = await auth.api
      .updateUser({
        body: { nickname: "Hacker" } as Record<string, unknown>,
        headers: new Headers({ cookie: jesper.cookie }),
      })
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(isAPIError(error)).toBe(true);
    if (isAPIError(error)) expect(error.body?.code).toBe("FIELD_NOT_ALLOWED");
    expect((await db.user.findUniqueOrThrow({ where: { id: jesper.id } })).nickname).toBeNull();
  });

  it("Better Auth afviser kælenavnet ved oprettelse af en konto (FIELD_NOT_ALLOWED)", async () => {
    const email = `r3data-${randomUUID()}@example.test`;
    const error = await auth.api
      .signUpEmail({
        body: { name: "Snyder", email, password: "itest-password-123", nickname: "Kaptajnen" },
      } as Parameters<typeof auth.api.signUpEmail>[0])
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(isAPIError(error) && error.body?.code).toBe("FIELD_NOT_ALLOWED");
    expect(await db.user.count({ where: { email } })).toBe(0);
  });

  it("updateUserProfile gemmer navn og kælenavn renset, og sessionen viser kælenavnet", async () => {
    expect(
      await updateUserProfile(jesper.id, {
        name: " Jesper   Thomsen ",
        nickname: " Kap\u0000tajnen ",
      }),
    ).toEqual({ name: "Jesper Thomsen", nickname: "Kaptajnen" });
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: jesper.cookie }),
      query: { disableRefresh: true },
    });
    expect(session?.user.nickname).toBe("Kaptajnen");
    expect(await updateUserProfile(jesper.id, { name: "Jesper Thomsen", nickname: "  " })).toEqual({
      name: "Jesper Thomsen",
      nickname: null,
    });
    await updateUserProfile(jesper.id, { name: "Jesper Thomsen", nickname: "Kaptajnen" });
  });

  it("findClubMember og listMemberOptions bruger kælenavnet og klubben", async () => {
    const mads = await createUser("Mads");
    await db.membership.create({ data: { clubId, userId: mads.id, role: "MEMBER" } });
    expect(await findClubMember(clubId, jesper.id)).toMatchObject({
      id: jesper.id,
      name: "Jesper Thomsen",
      nickname: "Kaptajnen",
      role: "ADMIN",
    });
    expect(await findClubMember(clubId, randomUUID())).toBeNull();
    // Sorted by display name: "Kaptajnen" before "Mads".
    expect((await listMemberOptions(clubId)).map((option) => option.id)).toEqual([
      jesper.id,
      mads.id,
    ]);
  });

  it("getAccountLogins, listUserClubIds, revokeOtherSessions og revokePasswordResetTokens", async () => {
    const user = await createUser("Login Bruger");
    expect(await getAccountLogins(user.id)).toEqual({ hasPassword: true, external: [] });
    await addGoogleAccount(user);
    expect(await getAccountLogins(user.id)).toEqual({ hasPassword: true, external: ["google"] });

    expect(await listUserClubIds(user.id)).toEqual([]);
    const ownClub = await createClub(user, "Login-klubben");
    expect(await listUserClubIds(user.id)).toEqual([ownClub]);

    const current = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    await db.session.create({
      data: {
        userId: user.id,
        token: `other-${randomUUID()}`,
        expiresAt: new Date(Date.now() + DAY),
      },
    });
    expect(await revokeOtherSessions(user.id, current.id)).toBe(1);
    expect((await db.session.findMany({ where: { userId: user.id } })).map((s) => s.id)).toEqual([
      current.id,
    ]);

    await db.verification.create({
      data: {
        identifier: `reset-${randomUUID()}`,
        value: user.id,
        expiresAt: new Date(Date.now() + HOUR),
      },
    });
    await revokePasswordResetTokens(user.id);
    expect(await db.verification.count({ where: { value: user.id } })).toBe(0);
  });
});

// ── History (D-107) ──────────────────────────────────────────────────────────

describe("tidligere ølsmagninger (listPastEvents, D-107)", () => {
  it("er det præcise komplement af kommende, nyeste først, med øl og bedste øl", async () => {
    const admin = await person("Historik Admin");
    const rater = await person("Historik Rater");
    const clubId = await clubWith(admin, [[rater, "MEMBER"]]);
    const spot = await place(clubId, admin, "Historiksted");
    const now = new Date("2030-06-01T18:00:00Z");
    const at = (ms: number) => new Date(now.getTime() + ms);
    const make = (title: string, startsAt: Date, endsAt: Date | null) =>
      createEvent(eventInput(clubId, admin.id, existing(spot), { title, startsAt, endsAt }));

    const endedNow = await make("Sluttede nu", at(-3 * HOUR), now);
    await make("Slutter om lidt", at(-3 * HOUR), at(1));
    const sixHours = await make("Uden slut, 6 t siden", at(-6 * HOUR), null);
    await make("Uden slut, lige under 6 t", at(-6 * HOUR + 1), null);
    const old = await make("Gammel", at(-30 * DAY), at(-30 * DAY + 4 * HOUR));

    const beers = await Promise.all(
      ["Westmalle Tripel", "Duvel", "Ny øl"].map((name) =>
        createBeer({ clubId, createdById: admin.id, name, abv: 8, eventId: old.id }),
      ),
    );
    await setRating({ clubId, beerId: beers[0]?.id ?? "", userId: admin.id, value: 10 });
    await setRating({ clubId, beerId: beers[0]?.id ?? "", userId: rater.id, value: 9 });
    await setRating({ clubId, beerId: beers[1]?.id ?? "", userId: admin.id, value: 6 });

    const past = await listPastEvents(clubId, now);
    expect(past.map((event) => event.id)).toEqual([endedNow.id, sixHours.id, old.id]);
    expect(await countPastEvents(clubId, now)).toBe(3);
    expect(past[2]).toMatchObject({
      beerCount: 3,
      topBeer: { id: beers[0]?.id, name: "Westmalle Tripel", averageStars: 4.75 },
      place: { id: spot, name: "Historiksted" },
    });
    expect(past[0]).toMatchObject({ beerCount: 0, topBeer: null });
    expect((await listPastEvents(clubId, now, { limit: 2 })).map((event) => event.id)).toEqual([
      endedNow.id,
      sixHours.id,
    ]);

    const upcoming = await listUpcomingEvents(clubId, now);
    expect(upcoming.map((event) => event.title).sort()).toEqual(
      ["Slutter om lidt", "Uden slut, lige under 6 t"].sort(),
    );
  });
});
