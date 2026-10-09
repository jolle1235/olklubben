import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { CONFIRM_NAME_MISMATCH_MESSAGE } from "@/lib/validation/club";
import { deleteClubAction, updateClubInfoAction } from "@/server/actions/clubs";
import { leaveClubAction, removeMemberAction, setMemberRoleAction } from "@/server/actions/members";
import { db } from "@/server/db";
import { MEMBERSHIP_MESSAGES } from "@/server/domain/clubs/membership-rules";
import type { ClubRole } from "@/server/domain/clubs/permissions";

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
 * Agent A's Server Actions for members and the club (SPEC §5.1, §7.4, §7.5,
 * §9.8; E1–E3, E15, E16; D-102–D-104, D-110) against the real database:
 * every action 404s for non-members and malformed ids, refuses plain members,
 * and maps the data layer's decisions to the Danish messages. The lock-based
 * races are proven in round3-data.itest.ts.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const MALFORMED = "ikke-et-id";
const UNKNOWN_ID = "01890000-0000-7000-8000-000000000000";
const HOUR = 60 * 60 * 1000;

beforeEach(() => setActor(null));

async function roleOf(clubId: string, user: TestUser): Promise<ClubRole | null> {
  const membership = await db.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/** A club with an admin, a second admin (optional) and a plain member. */
async function clubWithMembers(options: { secondAdmin?: boolean } = {}) {
  const admin = await createUser("Admin Anna");
  const member = await createUser("Medlem Mads");
  const clubId = await createClub(admin, "Medlemsklubben");
  await addMember(clubId, member);
  let otherAdmin: TestUser | null = null;
  if (options.secondAdmin) {
    otherAdmin = await createUser("Admin Bo");
    await addMember(clubId, otherAdmin, "ADMIN");
  }
  return { admin, member, otherAdmin, clubId };
}

describe("setMemberRoleAction", () => {
  it("admin gør et medlem til admin og fjerner rollen igen", async () => {
    const { admin, member, clubId } = await clubWithMembers();
    setActor(admin);

    expect(await setMemberRoleAction(clubId, member.id, "ADMIN")).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await roleOf(clubId, member)).toBe("ADMIN");

    // The same role again is a harmless no-op.
    expect((await setMemberRoleAction(clubId, member.id, "ADMIN")).ok).toBe(true);

    expect((await setMemberRoleAction(clubId, member.id, "MEMBER")).ok).toBe(true);
    expect(await roleOf(clubId, member)).toBe("MEMBER");
  });

  it("den sidste admin kan ikke fjerne sin egen rolle; med to admins kan man (E2)", async () => {
    const { admin, member, clubId } = await clubWithMembers();
    setActor(admin);

    expect(await setMemberRoleAction(clubId, admin.id, "MEMBER")).toEqual({
      ok: false,
      error: { code: ACTION_ERROR_CODES.LAST_ADMIN, message: MEMBERSHIP_MESSAGES.LAST_ADMIN },
    });
    expect(await roleOf(clubId, admin)).toBe("ADMIN");

    await setMemberRoleAction(clubId, member.id, "ADMIN");
    expect((await setMemberRoleAction(clubId, admin.id, "MEMBER")).ok).toBe(true);
    expect(await roleOf(clubId, admin)).toBe("MEMBER");
    expect(await roleOf(clubId, member)).toBe("ADMIN");
  });

  it("et almindeligt medlem får FORBIDDEN, og intet ændres", async () => {
    const { admin, member, clubId } = await clubWithMembers();
    setActor(member);

    expect(await setMemberRoleAction(clubId, member.id, "ADMIN")).toEqual({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN, message: MEMBERSHIP_MESSAGES.FORBIDDEN },
    });
    expect(await setMemberRoleAction(clubId, admin.id, "MEMBER")).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN },
    });
    expect(await roleOf(clubId, member)).toBe("MEMBER");
    expect(await roleOf(clubId, admin)).toBe("ADMIN");
  });

  it("404 for ikke-medlemmer, forkerte id'er, en anden klubs bruger og en ukendt rolle", async () => {
    const { admin, member, clubId } = await clubWithMembers();
    const outsider = await createUser("Udenfor");
    const otherClubId = await createClub(outsider, "Fremmed klub");

    setActor(outsider);
    await expectNotFound(setMemberRoleAction(clubId, member.id, "ADMIN"));

    setActor(admin);
    await expectNotFound(setMemberRoleAction(MALFORMED, member.id, "ADMIN"));
    await expectNotFound(setMemberRoleAction(clubId, MALFORMED, "ADMIN"));
    await expectNotFound(setMemberRoleAction(clubId, UNKNOWN_ID, "ADMIN"));
    // A user of another club is not here (§4.4), and nothing changes there.
    await expectNotFound(setMemberRoleAction(clubId, outsider.id, "MEMBER"));
    expect(await roleOf(otherClubId, outsider)).toBe("ADMIN");
    await expectNotFound(setMemberRoleAction(clubId, member.id, "OWNER" as ClubRole));
    expect(await roleOf(clubId, member)).toBe("MEMBER");
  });

  it("sender en logget-ud bruger til login", async () => {
    const { member, clubId } = await clubWithMembers();
    await expectRedirect(setMemberRoleAction(clubId, member.id, "ADMIN"), /^\/login$/);
  });
});

describe("removeMemberAction", () => {
  it("admin fjerner et medlem: adgangen er væk (E16), historikken bliver (§7.4)", async () => {
    const { admin, member, clubId } = await clubWithMembers();
    const placeId = await createPlace(clubId, member, "Hos Mads", { ownerIds: [member.id] });
    const event = await db.event.create({
      data: {
        clubId,
        title: "Kommende smagning",
        startsAt: new Date(Date.now() + 48 * HOUR),
        placeId,
        createdById: member.id,
        hosts: { createMany: { data: [{ userId: member.id }] } },
      },
      select: { id: true },
    });
    setActor(admin);

    expect(await removeMemberAction(clubId, member.id)).toEqual({ ok: true, data: undefined });
    expect(await roleOf(clubId, member)).toBeNull();
    expect(await db.placeOwner.count({ where: { placeId } })).toBe(0);
    expect(await db.eventHost.count({ where: { eventId: event.id } })).toBe(0);
    // The event and the place stay in the club.
    expect(await db.event.count({ where: { id: event.id } })).toBe(1);
    expect(await db.place.count({ where: { id: placeId } })).toBe(1);

    // The removed member's next request to the club is a 404 (E16).
    setActor(member);
    await expectNotFound(leaveClubAction(clubId));

    // Removing someone who is no longer a member is a harmless no-op.
    setActor(admin);
    expect((await removeMemberAction(clubId, member.id)).ok).toBe(true);
  });

  it("man kan ikke fjerne sig selv (USE_LEAVE), og et medlem får FORBIDDEN", async () => {
    const { admin, member, clubId } = await clubWithMembers({ secondAdmin: true });

    setActor(admin);
    expect(await removeMemberAction(clubId, admin.id)).toEqual({
      ok: false,
      error: { code: ACTION_ERROR_CODES.USE_LEAVE, message: MEMBERSHIP_MESSAGES.USE_LEAVE },
    });
    expect(await roleOf(clubId, admin)).toBe("ADMIN");

    setActor(member);
    expect(await removeMemberAction(clubId, admin.id)).toEqual({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN, message: MEMBERSHIP_MESSAGES.FORBIDDEN },
    });
    expect(await roleOf(clubId, admin)).toBe("ADMIN");
  });

  it("en admin kan fjerne en anden admin, når der stadig er en admin tilbage", async () => {
    const { admin, otherAdmin, clubId } = await clubWithMembers({ secondAdmin: true });
    if (!otherAdmin) throw new Error("mangler anden admin");
    setActor(admin);

    expect((await removeMemberAction(clubId, otherAdmin.id)).ok).toBe(true);
    expect(await roleOf(clubId, otherAdmin)).toBeNull();
  });

  it("404 for ikke-medlemmer og forkerte id'er; en anden klubs bruger er et no-op", async () => {
    const { admin, member, clubId } = await clubWithMembers();
    const outsider = await createUser("Udenfor");
    const otherClubId = await createClub(outsider, "Fremmed klub");

    setActor(outsider);
    await expectNotFound(removeMemberAction(clubId, member.id));
    expect(await roleOf(clubId, member)).toBe("MEMBER");

    setActor(admin);
    await expectNotFound(removeMemberAction(MALFORMED, member.id));
    await expectNotFound(removeMemberAction(clubId, MALFORMED));
    expect((await removeMemberAction(clubId, outsider.id)).ok).toBe(true);
    expect(await roleOf(otherClubId, outsider)).toBe("ADMIN");
  });
});

describe("leaveClubAction", () => {
  it("sender hjem med en toast: onboarding, den ene klub eller klubvælgeren (D-104)", async () => {
    const admin = await createUser("Admin");
    const clubId = await createClub(admin, "Forladt klub");

    const alone = await createUser("Uden andre klubber");
    await addMember(clubId, alone);
    setActor(alone);
    await expectRedirect(leaveClubAction(clubId), /^\/onboarding\?toast=club-left$/);

    const single = await createUser("Én klub tilbage");
    const singleClubId = await createClub(single, "Egen klub");
    await addMember(clubId, single);
    setActor(single);
    await expectRedirect(
      leaveClubAction(clubId),
      new RegExp(`^/c/${singleClubId}\\?toast=club-left$`),
    );

    const many = await createUser("Flere klubber");
    await createClub(many, "Klub et");
    await createClub(many, "Klub to");
    await addMember(clubId, many);
    setActor(many);
    await expectRedirect(leaveClubAction(clubId), /^\/clubs\?toast=club-left$/);

    expect(await db.membership.count({ where: { clubId } })).toBe(1);
  });

  it("nulstiller aktiv klub, når den peger på klubben (E15)", async () => {
    const { member, clubId } = await clubWithMembers();
    await db.user.update({ where: { id: member.id }, data: { lastActiveClubId: clubId } });
    setActor(member);

    await expectRedirect(leaveClubAction(clubId), /^\/onboarding\?toast=club-left$/);
    const user = await db.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(user.lastActiveClubId).toBeNull();
  });

  it("den sidste admin og det eneste medlem kan ikke forlade klubben (E2, E3)", async () => {
    const { admin, clubId } = await clubWithMembers();
    setActor(admin);
    expect(await leaveClubAction(clubId)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.LAST_ADMIN,
        message: MEMBERSHIP_MESSAGES.LAST_ADMIN_LEAVE,
      },
    });
    expect(await roleOf(clubId, admin)).toBe("ADMIN");

    const solo = await createUser("Alene");
    const soloClubId = await createClub(solo, "Enmandsklub");
    setActor(solo);
    expect(await leaveClubAction(soloClubId)).toEqual({
      ok: false,
      error: { code: ACTION_ERROR_CODES.ONLY_MEMBER, message: MEMBERSHIP_MESSAGES.ONLY_MEMBER },
    });
    expect(await roleOf(soloClubId, solo)).toBe("ADMIN");
  });

  it("en admin kan gå, når der er en anden admin", async () => {
    const { admin, otherAdmin, clubId } = await clubWithMembers({ secondAdmin: true });
    if (!otherAdmin) throw new Error("mangler anden admin");
    setActor(admin);

    await expectRedirect(leaveClubAction(clubId), /^\/onboarding\?toast=club-left$/);
    expect(await roleOf(clubId, admin)).toBeNull();
    expect(await roleOf(clubId, otherAdmin)).toBe("ADMIN");
  });

  it("404 for ikke-medlemmer og et forkert id", async () => {
    const { clubId } = await clubWithMembers();
    const outsider = await createUser("Udenfor");
    setActor(outsider);
    await expectNotFound(leaveClubAction(clubId));
    await expectNotFound(leaveClubAction(MALFORMED));
  });
});

describe("updateClubInfoAction", () => {
  it("admin gemmer navn og beskrivelse (renset) og kommer tilbage til klubben", async () => {
    const { admin, clubId } = await clubWithMembers();
    setActor(admin);

    await expectRedirect(
      updateClubInfoAction(
        null,
        formData({
          clubId,
          name: "  Nye Navn\u0000 ",
          description: "  Første linje\r\nAnden linje  ",
        }),
      ),
      new RegExp(`^/c/${clubId}/club\\?toast=club-updated$`),
    );
    const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
    expect(club.name).toBe("Nye Navn");
    expect(club.description).toBe("Første linje\nAnden linje");

    // An empty description removes it.
    await expectRedirect(
      updateClubInfoAction(null, formData({ clubId, name: "Nye Navn", description: "   " })),
      /toast=club-updated$/,
    );
    expect((await db.club.findUniqueOrThrow({ where: { id: clubId } })).description).toBeNull();
  });

  it("afviser 61 tegns navn og 301 tegns beskrivelse og sender det skrevne tilbage", async () => {
    const { admin, clubId } = await clubWithMembers();
    setActor(admin);
    const values = { name: "x".repeat(61), description: "y".repeat(301) };

    const result = await updateClubInfoAction(null, formData({ clubId, ...values }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.VALIDATION,
        fieldErrors: {
          name: ["Klubnavnet må højst være 60 tegn."],
          description: ["Beskrivelsen må højst være 300 tegn."],
        },
      },
      values,
    });
    expect((await db.club.findUniqueOrThrow({ where: { id: clubId } })).name).toBe(
      "Medlemsklubben",
    );
  });

  it("et almindeligt medlem får FORBIDDEN; ikke-medlemmer og forkerte id'er får 404", async () => {
    const { member, clubId } = await clubWithMembers();
    setActor(member);
    expect(
      await updateClubInfoAction(null, formData({ clubId, name: "Kuppet", description: "" })),
    ).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });
    expect((await db.club.findUniqueOrThrow({ where: { id: clubId } })).name).toBe(
      "Medlemsklubben",
    );

    const outsider = await createUser("Udenfor");
    setActor(outsider);
    await expectNotFound(updateClubInfoAction(null, formData({ clubId, name: "Kuppet" })));
    await expectNotFound(
      updateClubInfoAction(null, formData({ clubId: MALFORMED, name: "Kuppet" })),
    );
  });
});

describe("deleteClubAction", () => {
  it("et forkert navn giver en fejl på feltet, og klubben består", async () => {
    const { admin, clubId } = await clubWithMembers();
    setActor(admin);

    for (const confirmName of ["Medlemsklub", "", "x".repeat(201)]) {
      const result = await deleteClubAction(clubId, formData({ confirmName }));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.fieldErrors?.confirmName).toEqual([CONFIRM_NAME_MISMATCH_MESSAGE]);
    }
    const mismatch = await deleteClubAction(clubId, formData({ confirmName: "Medlemsklub" }));
    expect(mismatch).toMatchObject({ error: { code: ACTION_ERROR_CODES.NAME_MISMATCH } });
    expect(await db.club.count({ where: { id: clubId } })).toBe(1);
  });

  it("navnet i andre bogstaver og mellemrum sletter klubben og sender hjem (D-103)", async () => {
    const admin = await createUser("Admin");
    const member = await createUser("Medlem");
    const clubId = await createClub(admin, "Drengene & Bajere");
    const keptClubId = await createClub(admin, "Den anden klub");
    await addMember(clubId, member);
    setActor(admin);

    await expectRedirect(
      deleteClubAction(clubId, formData({ confirmName: "  drengene &  BAJERE " })),
      new RegExp(`^/c/${keptClubId}\\?toast=club-deleted$`),
    );
    expect(await db.club.count({ where: { id: clubId } })).toBe(0);
    expect(await db.membership.count({ where: { clubId } })).toBe(0);
    // Accounts stay (§7.5).
    expect(await db.user.count({ where: { id: { in: [admin.id, member.id] } } })).toBe(2);
  });

  it("et almindeligt medlem får FORBIDDEN; ikke-medlemmer og forkerte id'er får 404", async () => {
    const { member, clubId } = await clubWithMembers();
    setActor(member);
    expect(
      await deleteClubAction(clubId, formData({ confirmName: "Medlemsklubben" })),
    ).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });
    expect(await db.club.count({ where: { id: clubId } })).toBe(1);

    const outsider = await createUser("Udenfor");
    setActor(outsider);
    await expectNotFound(deleteClubAction(clubId, formData({ confirmName: "Medlemsklubben" })));
    await expectNotFound(deleteClubAction(MALFORMED, formData({ confirmName: "x" })));
    expect(await db.club.count({ where: { id: clubId } })).toBe(1);
  });
});
