import { beforeEach, describe, expect, it, vi } from "vitest";

import { RETURN_TO_HEADER } from "@/lib/protected-paths";

// Next.js request APIs and navigation signals, replaced for unit tests.
const headersMock = vi.fn(async () => new Headers());
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

const getSessionMock = vi.fn();
vi.mock("./auth", () => ({ auth: { api: { getSession: getSessionMock } } }));

const membershipFindUnique = vi.fn();
const membershipFindMany = vi.fn();
const userUpdate = vi.fn();
vi.mock("@/server/db", () => ({
  db: {
    membership: { findUnique: membershipFindUnique, findMany: membershipFindMany },
    user: { update: userUpdate },
  },
}));

const {
  getHomePath,
  getUserClubs,
  rememberActiveClub,
  requireClubPage,
  requireMembership,
  requireUser,
} = await import("./session");

const CLUB_ID = "0199c4a5-3f1e-7c2a-9b1d-2f3e4a5b6c7d";
const now = new Date("2026-10-08T12:00:00Z");
const authUser = {
  id: "0199c4a5-0000-7000-8000-000000000001",
  name: "Jesper",
  email: "jesper@example.com",
  emailVerified: false,
  image: undefined,
  lastActiveClubId: undefined,
  createdAt: now,
  updatedAt: now,
};

function loggedIn() {
  getSessionMock.mockResolvedValue({ session: { id: "s", userId: authUser.id }, user: authUser });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue(null);
  headersMock.mockImplementation(async () => new Headers());
});

describe("requireUser", () => {
  it("returns the user with null for missing optional fields", async () => {
    loggedIn();
    await expect(requireUser()).resolves.toMatchObject({
      id: authUser.id,
      image: null,
      lastActiveClubId: null,
    });
  });

  it("redirects a logged-out visitor to /login", async () => {
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("keeps a safe returnTo as ?next= and drops an unsafe one", async () => {
    await expect(requireUser({ returnTo: "/join/K7XMQ2PA" })).rejects.toThrow(
      "NEXT_REDIRECT /login?next=%2Fjoin%2FK7XMQ2PA",
    );
    await expect(requireUser({ returnTo: "//evil.com" })).rejects.toThrow(
      /^NEXT_REDIRECT \/login$/,
    );
  });

  it("keeps the page the proxy saw (stale cookie) as ?next=", async () => {
    headersMock.mockResolvedValue(new Headers({ [RETURN_TO_HEADER]: "/c/abc/club?x=1" }));
    await expect(requireUser()).rejects.toThrow(
      "NEXT_REDIRECT /login?next=%2Fc%2Fabc%2Fclub%3Fx%3D1",
    );
    // An explicit returnTo wins.
    await expect(requireUser({ returnTo: "/join/K7XMQ2PA" })).rejects.toThrow(
      "NEXT_REDIRECT /login?next=%2Fjoin%2FK7XMQ2PA",
    );
  });

  it("drops an unsafe return path from the header", async () => {
    headersMock.mockResolvedValue(new Headers({ [RETURN_TO_HEADER]: "//evil.com" }));
    await expect(requireUser()).rejects.toThrow(/^NEXT_REDIRECT \/login$/);
  });
});

describe("requireMembership", () => {
  it("gives 404 for a malformed club id without touching the database", async () => {
    loggedIn();
    await expect(requireMembership("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(membershipFindUnique).not.toHaveBeenCalled();
  });

  it("gives 404 (not 403) when the user is not a member or the club does not exist", async () => {
    loggedIn();
    membershipFindUnique.mockResolvedValue(null);
    await expect(requireMembership(CLUB_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(membershipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_clubId: { userId: authUser.id, clubId: CLUB_ID } },
      }),
    );
  });

  it("redirects to /login before looking at the club when logged out", async () => {
    await expect(requireMembership(CLUB_ID)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(membershipFindUnique).not.toHaveBeenCalled();
  });

  it("returns user, membership and club for a member", async () => {
    loggedIn();
    const club = { id: CLUB_ID, name: "Drengene & Bajere", description: null, createdAt: now };
    membershipFindUnique.mockResolvedValue({
      id: "m1",
      userId: authUser.id,
      clubId: CLUB_ID,
      role: "ADMIN",
      joinedAt: now,
      club,
    });

    const result = await requireMembership(CLUB_ID);
    expect(result.club).toEqual(club);
    expect(result.membership).toEqual({
      id: "m1",
      userId: authUser.id,
      clubId: CLUB_ID,
      role: "ADMIN",
      joinedAt: now,
    });
    expect(result.user.id).toBe(authUser.id);
  });
});

describe("getUserClubs / getHomePath", () => {
  function clubsFixture(names: string[]) {
    return names.map((name, index) => ({
      role: index === 0 ? "ADMIN" : "MEMBER",
      club: { id: `club-${index}`, name, _count: { memberships: index + 2 } },
    }));
  }

  it("sorts clubs by name the Danish way (Æ, Ø, Å after Z)", async () => {
    membershipFindMany.mockResolvedValue(
      clubsFixture(["Ølklubben", "Åbyhøj Bryg", "Zymurgi", "Æblemost", "Drengene & Bajere"]),
    );
    const clubs = await getUserClubs("u1");
    expect(clubs.map((club) => club.name)).toEqual([
      "Drengene & Bajere",
      "Zymurgi",
      "Æblemost",
      "Ølklubben",
      "Åbyhøj Bryg",
    ]);
    expect(clubs[3]).toEqual({ id: "club-0", name: "Ølklubben", role: "ADMIN", memberCount: 2 });
  });

  it("routes per SPEC §10.1", async () => {
    membershipFindMany.mockResolvedValue([]);
    await expect(getHomePath({ id: "u-none", lastActiveClubId: null })).resolves.toBe(
      "/onboarding",
    );

    membershipFindMany.mockResolvedValue(clubsFixture(["A", "B"]));
    await expect(getHomePath({ id: "u-two", lastActiveClubId: "club-1" })).resolves.toBe(
      "/c/club-1",
    );
    await expect(getHomePath({ id: "u-two-b", lastActiveClubId: "gone" })).resolves.toBe("/clubs");
  });
});

describe("rememberActiveClub", () => {
  it("writes only when the club changes", async () => {
    await rememberActiveClub({ id: "u1", lastActiveClubId: CLUB_ID }, CLUB_ID);
    expect(userUpdate).not.toHaveBeenCalled();

    await rememberActiveClub({ id: "u1", lastActiveClubId: null }, CLUB_ID);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { lastActiveClubId: CLUB_ID },
    });
  });
});

describe("requireClubPage", () => {
  const club = { id: CLUB_ID, name: "Drengene & Bajere", description: null, createdAt: now };

  it("checks membership, then remembers the club as the active one", async () => {
    loggedIn();
    membershipFindUnique.mockResolvedValue({
      id: "m1",
      userId: authUser.id,
      clubId: CLUB_ID,
      role: "MEMBER",
      joinedAt: now,
      club,
    });

    const result = await requireClubPage(CLUB_ID);
    expect(result.club).toEqual(club);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: authUser.id },
      data: { lastActiveClubId: CLUB_ID },
    });
  });

  it("gives 404 for a non-member and remembers nothing", async () => {
    loggedIn();
    membershipFindUnique.mockResolvedValue(null);
    await expect(requireClubPage(CLUB_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
