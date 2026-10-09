import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import {
  createClub,
  createMemberResetLink,
  joinClub,
  regenerateInvite,
} from "@/server/actions/clubs";
import { isPasswordResetTokenValid } from "@/server/auth/reset-link";
import { db } from "@/server/db";
import { formatInviteCode, generateInviteCode } from "@/server/domain/clubs/invite-code";
import { INVITE_NOT_WORKING_CODE, INVITE_NOT_WORKING_MESSAGE } from "@/server/domain/clubs/invites";

import {
  activeInvite,
  addGoogleAccount,
  addMember,
  createClub as createTestClub,
  createUser,
  expectNotFound,
  expectRedirect,
  formData,
  setActor,
  type TestUser,
} from "./helpers";

/**
 * The Round 1 Server Actions against the real database (SPEC §15.3
 * "Integration"): each call goes through the §4.3 order – validate, user,
 * membership, resource, permission, mutation, revalidate/redirect.
 *
 * Only next/headers (no request outside Next.js) and next/cache are mocked.
 * notFound() and redirect() are the real ones; they throw errors with a digest.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLUB_PATH = new RegExp(`^/c/(${UUID})$`);
const INVITE_CODE = /^[2-9A-HJKMNP-Z]{8}$/;
const OTHER_CLUB_ID = "01890000-0000-7000-8000-000000000000";

beforeEach(() => setActor(null));

function clubIdFrom(path: string): string {
  const id = CLUB_PATH.exec(path)?.[1];
  if (!id) throw new Error(`Ikke en klubsti: ${path}`);
  return id;
}

async function resetRowCount(user: TestUser): Promise<number> {
  // Reset tokens are the only verification rows whose value is a bare user id.
  return db.verification.count({ where: { value: user.id } });
}

describe("createClub", () => {
  it("gør opretteren til Admin, laver én aktiv kode og åbner klubben", async () => {
    const user = await createUser();
    setActor(user);

    const path = await expectRedirect(
      createClub(null, formData({ name: "  Humlebanden  " })),
      CLUB_PATH,
    );
    const clubId = clubIdFrom(path);

    const club = await db.club.findUniqueOrThrow({
      where: { id: clubId },
      select: { name: true, memberships: { select: { userId: true, role: true } } },
    });
    expect(club.name).toBe("Humlebanden");
    expect(club.memberships).toEqual([{ userId: user.id, role: "ADMIN" }]);

    const invites = await db.invite.findMany({ where: { clubId, revokedAt: null } });
    expect(invites).toHaveLength(1);
    expect(invites[0]?.code).toMatch(INVITE_CODE);

    const { lastActiveClubId } = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(lastActiveClubId).toBe(clubId);
  });

  it("afviser et ugyldigt navn uden at oprette noget", async () => {
    const user = await createUser();
    setActor(user);

    for (const name of ["   ", "x".repeat(61)]) {
      const result = await createClub(null, formData({ name }));
      expect(result).toMatchObject({
        ok: false,
        error: { code: ACTION_ERROR_CODES.VALIDATION, fieldErrors: { name: expect.any(Array) } },
      });
    }
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
  });

  it("sender en logget-ud bruger til login", async () => {
    await expectRedirect(createClub(null, formData({ name: "Ingen" })), /^\/login$/);
  });
});

describe("regenerateInvite", () => {
  it("admin: den gamle kode tilbagekaldes, og en ny er aktiv", async () => {
    const admin = await createUser();
    const clubId = await createTestClub(admin);
    const before = await activeInvite(clubId);
    setActor(admin);

    expect(await regenerateInvite(clubId)).toEqual({ ok: true, data: undefined });

    const old = await db.invite.findUniqueOrThrow({ where: { id: before?.id } });
    expect(old.revokedAt).not.toBeNull();
    const now = await activeInvite(clubId);
    expect(now?.code).toMatch(INVITE_CODE);
    expect(now?.code).not.toBe(before?.code);
    expect(await db.invite.count({ where: { clubId, revokedAt: null } })).toBe(1);
  });

  it("medlem: FORBIDDEN, og koden er uændret", async () => {
    const admin = await createUser();
    const member = await createUser();
    const clubId = await createTestClub(admin);
    await addMember(clubId, member);
    const before = await activeInvite(clubId);
    setActor(member);

    const result = await regenerateInvite(clubId);

    expect(result).toEqual({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN, message: "Kun admins kan generere en ny kode." },
    });
    expect(await activeInvite(clubId)).toEqual(before);
    expect(await db.invite.count({ where: { clubId } })).toBe(1);
  });

  it("ikke-medlem, en anden klub og et ugyldigt id giver 404", async () => {
    const admin = await createUser();
    const outsider = await createUser();
    const clubId = await createTestClub(admin);
    const outsidersClubId = await createTestClub(outsider);
    const before = await activeInvite(clubId);

    setActor(outsider);
    await expectNotFound(regenerateInvite(clubId));
    expect(await activeInvite(clubId)).toEqual(before);

    // An admin of one club cannot touch another club, or one that does not exist.
    setActor(admin);
    await expectNotFound(regenerateInvite(outsidersClubId));
    await expectNotFound(regenerateInvite(OTHER_CLUB_ID));
    await expectNotFound(regenerateInvite("ikke-et-id"));
  });
});

describe("createMemberResetLink", () => {
  it("admin: et gyldigt engangslink til medlemmet", async () => {
    const admin = await createUser();
    const member = await createUser("Mikkel Medlem");
    const clubId = await createTestClub(admin);
    await addMember(clubId, member);
    setActor(admin);

    const result = await createMemberResetLink(clubId, member.id);

    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.name).toBe("Mikkel Medlem");
    const url = new URL(result.data.url);
    expect(`${url.origin}${url.pathname}`).toBe(`${process.env.BETTER_AUTH_URL}/reset-password`);
    expect(await isPasswordResetTokenValid(url.searchParams.get("token"))).toBe(true);
    expect(await resetRowCount(member)).toBe(1);
  });

  it("et nyt link ugyldiggør det forrige (A3)", async () => {
    const admin = await createUser();
    const member = await createUser();
    const clubId = await createTestClub(admin);
    await addMember(clubId, member);
    setActor(admin);

    const first = await createMemberResetLink(clubId, member.id);
    const second = await createMemberResetLink(clubId, member.id);

    if (!first.ok || !second.ok) throw new Error("forventede to links");
    const token = (url: string) => new URL(url).searchParams.get("token");
    expect(await isPasswordResetTokenValid(token(first.data.url))).toBe(false);
    expect(await isPasswordResetTokenValid(token(second.data.url))).toBe(true);
    expect(await resetRowCount(member)).toBe(1);
  });

  it("medlem: FORBIDDEN uden noget link", async () => {
    const admin = await createUser();
    const member = await createUser();
    const other = await createUser();
    const clubId = await createTestClub(admin);
    await addMember(clubId, member);
    await addMember(clubId, other);
    setActor(member);

    const result = await createMemberResetLink(clubId, other.id);

    expect(result).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });
    expect(await resetRowCount(other)).toBe(0);
  });

  it("et mål uden for klubben giver 404", async () => {
    const admin = await createUser();
    const stranger = await createUser();
    const clubId = await createTestClub(admin);
    await createTestClub(stranger);
    setActor(admin);

    await expectNotFound(createMemberResetLink(clubId, stranger.id));
    await expectNotFound(createMemberResetLink(clubId, "ikke-et-id"));
    await expectNotFound(createMemberResetLink("ikke-et-id", stranger.id));
    expect(await resetRowCount(stranger)).toBe(0);
  });

  it("afviser et medlem, der også er med i en klub, hvor admin kun er medlem (A2)", async () => {
    const admin = await createUser();
    const target = await createUser("Torben");
    const clubId = await createTestClub(admin);
    await addMember(clubId, target);
    // Another club, run by someone else, where the admin is a plain MEMBER.
    const otherAdmin = await createUser();
    const otherClubId = await createTestClub(otherAdmin);
    await addMember(otherClubId, admin, "MEMBER");
    await addMember(otherClubId, target);
    setActor(admin);

    const result = await createMemberResetLink(clubId, target.id);

    expect(result).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message:
          'Du kan ikke lave et nulstillingslink til Torben. Bed Torben om at bruge "Glemt password" eller logge ind med Google.',
      },
    });
    expect(await resetRowCount(target)).toBe(0);
  });

  it("afviser et medlem med Google-login (A2)", async () => {
    const admin = await createUser();
    const target = await createUser();
    const clubId = await createTestClub(admin);
    await addMember(clubId, target);
    await addGoogleAccount(target);
    setActor(admin);

    const result = await createMemberResetLink(clubId, target.id);

    expect(result).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });
    expect(await resetRowCount(target)).toBe(0);
  });
});

describe("joinClub", () => {
  async function clubWithCode(): Promise<{ clubId: string; code: string; inviteId: string }> {
    const admin = await createUser();
    const clubId = await createTestClub(admin);
    const invite = await activeInvite(clubId);
    if (!invite) throw new Error("klubben har ingen kode");
    return { clubId, code: invite.code, inviteId: invite.id };
  }

  it("en gyldig kode gør brugeren til medlem og åbner klubben", async () => {
    const { clubId, code } = await clubWithCode();
    const user = await createUser();
    setActor(user);

    // Any accepted spelling: lowercase with the display hyphen.
    await expectRedirect(
      joinClub(null, formData({ code: formatInviteCode(code).toLowerCase() })),
      `/c/${clubId}`,
    );

    const membership = await db.membership.findUnique({
      where: { userId_clubId: { userId: user.id, clubId } },
    });
    expect(membership?.role).toBe("MEMBER");
  });

  it("et eksisterende medlem sendes ind i klubben uden et nyt medlemskab (E17)", async () => {
    const { clubId, code } = await clubWithCode();
    const user = await createUser();
    setActor(user);

    await expectRedirect(joinClub(null, formData({ code })), `/c/${clubId}`);
    await expectRedirect(joinClub(null, formData({ code })), `/c/${clubId}`);

    expect(await db.membership.count({ where: { clubId } })).toBe(2);
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(1);
  });

  it("ukendt, tilbagekaldt og udløbet kode giver E18", async () => {
    const user = await createUser();
    const revoked = await clubWithCode();
    await db.invite.update({ where: { id: revoked.inviteId }, data: { revokedAt: new Date() } });
    const expired = await clubWithCode();
    await db.invite.update({
      where: { id: expired.inviteId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    setActor(user);

    for (const code of [generateInviteCode(), revoked.code, expired.code]) {
      expect(await joinClub(null, formData({ code }))).toEqual({
        ok: false,
        error: { code: INVITE_NOT_WORKING_CODE, message: INVITE_NOT_WORKING_MESSAGE },
      });
    }
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
  });

  it("en kode i forkert format giver en valideringsfejl", async () => {
    const user = await createUser();
    setActor(user);

    for (const code of ["", "K7XM", "OOOO-IIII"]) {
      expect(await joinClub(null, formData({ code }))).toMatchObject({
        ok: false,
        error: { code: ACTION_ERROR_CODES.VALIDATION, fieldErrors: { code: expect.any(Array) } },
      });
    }
  });
});
