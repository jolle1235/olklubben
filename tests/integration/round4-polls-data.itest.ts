import { beforeAll, describe, expect, it, vi } from "vitest";

import { GET as cronGET } from "@/app/api/cron/close-polls/route";
import { deleteClub, leaveClub, removeMember } from "@/server/clubs/membership";
import { getClubContentCounts } from "@/server/clubs/queries";
import { db } from "@/server/db";
import { getEvent, getSuggestedEventTitle } from "@/server/events/queries";
import { removePlace } from "@/server/places/mutations";
import { getPlace, getPlaceUsage } from "@/server/places/queries";
import { closeDuePolls, closePollIfDue, closeAllDuePolls } from "@/server/polls/close";
import {
  cancelPoll,
  castBallot,
  closePollManually,
  createPoll,
  PlaceNotSelectableError,
  resolvePollTie,
  updatePoll,
} from "@/server/polls/mutations";
import {
  countClubPolls,
  getPollRef,
  getPollView,
  getSuggestedPollTitle,
  listOverviewPolls,
  listPollDateOptions,
  listRecentEventStarts,
} from "@/server/polls/queries";

import {
  clubWith,
  DAY,
  eventsOfPoll,
  expirePoll,
  HOUR,
  inDays,
  insertBallot,
  insertPoll,
  LOOPS,
  MINUTE,
  person,
  place,
  pollState,
  settle,
  staggered,
  type Person,
} from "./poll-helpers";

/**
 * Round 4's data layer against the real database (SPEC §9.7, §7.4, §7.5;
 * D-129–D-139): the migration, the composite FKs, the partial index and the
 * CHECKs as backstops, createPoll / castBallot / the close with its event /
 * ties / cancel / edit, the lazy close, membership endings, deleting a club,
 * E5 on places, club scoping, and the lock-based invariants under real
 * concurrency (Promise.all, repeated LOOPS times).
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** A Postgres error from a write outside an interactive transaction, by SQLSTATE or constraint name. */
async function expectDbError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  const result = await settle(promise);
  expect(result.ok, "the write should have been refused").toBe(false);
  if (!result.ok) {
    const error = result.error as { message?: string; code?: string; meta?: unknown };
    const text = `${error.code ?? ""} ${error.message ?? ""} ${JSON.stringify(error.meta ?? {})}`;
    expect(text).toMatch(pattern);
  }
}

type Club = {
  clubId: string;
  admin: Person;
  mads: Person;
  anders: Person;
  hosMads: string;
  hosAnders: string;
  bar: string;
};

/** A club with an admin, two members and three places (Hos Mads, Hos Anders, a bar without owners). */
async function standardClub(name = "R4-standard"): Promise<Club> {
  const admin = await person("Admin");
  const mads = await person("Mads");
  const anders = await person("Anders");
  const clubId = await clubWith(
    admin,
    [
      [mads, "MEMBER"],
      [anders, "MEMBER"],
    ],
    name,
  );
  return {
    clubId,
    admin,
    mads,
    anders,
    hosMads: await place(clubId, mads, "Hos Mads", { ownerIds: [mads.id] }),
    hosAnders: await place(clubId, anders, "Hos Anders", { ownerIds: [anders.id] }),
    bar: await place(clubId, admin, "Baren"),
  };
}

/** A standard open poll: two dates, two places, created by Mads, deadline in 5 days. */
async function openPoll(club: Club, overrides: { createdById?: string } = {}) {
  return insertPoll({
    clubId: club.clubId,
    createdById: overrides.createdById ?? club.mads.id,
    title: "Ølsmagning #20",
    theme: "Juleøl",
    description: "Linje 1\nLinje 2",
    dates: [inDays(10), inDays(17)],
    placeIds: [club.hosMads, club.bar],
    deadline: inDays(5),
  });
}

// ── Migration (round4_polls) ────────────────────────────────────────────────

describe("migrationen round4_polls", () => {
  it("har fjernet events.location_text og tilføjet events.poll_id", async () => {
    const columns = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'`;
    const names = columns.map((column) => column.column_name);
    expect(names).not.toContain("location_text");
    expect(names).toContain("poll_id");
  });

  it("har de 9 CHECKs og det partielle unikke indeks", async () => {
    const checks = await db.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE contype = 'c' AND conrelid IN ('polls'::regclass, 'poll_options'::regclass)`;
    expect(checks.map((check) => check.conname).sort()).toEqual(
      [
        "poll_options_category_check",
        "polls_close_pair_check",
        "polls_description_length_check",
        "polls_lifecycle_cancelled_check",
        "polls_lifecycle_decided_check",
        "polls_lifecycle_open_check",
        "polls_manual_closer_check",
        "polls_theme_length_check",
        "polls_title_length_check",
      ].sort(),
    );
    const [index] = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'poll_votes_ballot_id_place_key'`;
    expect(index?.indexdef).toMatch(/UNIQUE INDEX .* \(ballot_id\) WHERE \(category = 'PLACE'/);
    const legacy = await db.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE conname = 'events_location_text_length_check'`;
    expect(legacy).toEqual([]);
  });
});

// ── DB backstops ────────────────────────────────────────────────────────────

describe("databasens garantier (D-129)", () => {
  let club: Club;
  let other: Club;
  let a: Awaited<ReturnType<typeof openPoll>>;
  let b: Awaited<ReturnType<typeof openPoll>>;

  beforeAll(async () => {
    club = await standardClub("R4-backstop");
    other = await standardClub("R4-naboen");
    a = await openPoll(club);
    b = await openPoll(club);
  });

  it("afviser en stemme på en anden afstemnings valgmulighed", async () => {
    const ballotId = await insertBallot({ pollId: a.pollId, userId: club.admin.id, optionIds: [] });
    await expectDbError(
      db.pollVote.create({
        data: {
          ballotId,
          pollId: a.pollId,
          optionId: b.dateOptionIds[0] as string,
          category: "DATE",
        },
      }),
      /P2003|poll_votes_option_id_poll_id_category_fkey|Foreign key/i,
    );
    // Not through the other poll's id either: the ballot is not in that poll.
    await expectDbError(
      db.pollVote.create({
        data: {
          ballotId,
          pollId: b.pollId,
          optionId: b.dateOptionIds[0] as string,
          category: "DATE",
        },
      }),
      /P2003|poll_votes_ballot_id_poll_id_fkey|Foreign key/i,
    );
  });

  it("afviser en DATE-stemme på et sted, et andet PLACE-kryds og et dobbelt kryds", async () => {
    const ballotId = await insertBallot({ pollId: a.pollId, userId: club.mads.id, optionIds: [] });
    await expectDbError(
      db.pollVote.create({
        data: {
          ballotId,
          pollId: a.pollId,
          optionId: a.placeOptionIds[0] as string,
          category: "DATE",
        },
      }),
      /P2003|poll_votes_option_id_poll_id_category_fkey|Foreign key/i,
    );
    await db.pollVote.create({
      data: {
        ballotId,
        pollId: a.pollId,
        optionId: a.placeOptionIds[0] as string,
        category: "PLACE",
      },
    });
    await expectDbError(
      db.pollVote.create({
        data: {
          ballotId,
          pollId: a.pollId,
          optionId: a.placeOptionIds[1] as string,
          category: "PLACE",
        },
      }),
      /P2002|poll_votes_ballot_id_place_key|Unique constraint/i,
    );
    await expectDbError(
      db.pollVote.create({
        data: {
          ballotId,
          pollId: a.pollId,
          optionId: a.placeOptionIds[0] as string,
          category: "PLACE",
        },
      }),
      /P2002|poll_votes_pkey|Unique constraint/i,
    );
    // Two DATE ticks are fine (approval voting).
    await db.pollVote.createMany({
      data: a.dateOptionIds.map((optionId) => ({
        ballotId,
        pollId: a.pollId,
        optionId,
        category: "DATE" as const,
      })),
    });
    expect(await db.pollVote.count({ where: { ballotId } })).toBe(3);
  });

  it("afviser en valgmulighed med en anden klubs sted", async () => {
    await expectDbError(
      db.pollOption.create({
        data: { pollId: a.pollId, clubId: club.clubId, category: "PLACE", placeId: other.bar },
      }),
      /P2003|poll_options_place_id_club_id_fkey|Foreign key/i,
    );
    // And not by claiming the other club: the poll is not in that club.
    await expectDbError(
      db.pollOption.create({
        data: { pollId: a.pollId, clubId: other.clubId, category: "PLACE", placeId: other.bar },
      }),
      /P2003|poll_options_poll_id_club_id_fkey|Foreign key/i,
    );
  });

  it("afviser et event med en anden klubs afstemning og et andet event til samme afstemning", async () => {
    await expectDbError(
      db.event.create({
        data: {
          clubId: other.clubId,
          placeId: other.bar,
          createdById: other.admin.id,
          title: "Snyd",
          startsAt: inDays(3),
          pollId: a.pollId,
        },
      }),
      /P2003|events_poll_id_club_id_fkey|Foreign key/i,
    );
    await db.event.create({
      data: {
        clubId: club.clubId,
        placeId: club.bar,
        createdById: club.admin.id,
        title: "Første",
        startsAt: inDays(3),
        pollId: b.pollId,
      },
    });
    await expectDbError(
      db.event.create({
        data: {
          clubId: club.clubId,
          placeId: club.bar,
          createdById: club.admin.id,
          title: "Anden",
          startsAt: inDays(3),
          pollId: b.pollId,
        },
      }),
      /P2002|events_poll_id_key|Unique constraint/i,
    );
  });

  it("håndhæver livscyklussen, kategorierne og længderne med CHECKs", async () => {
    const id = a.pollId;
    const now = new Date();
    await expectDbError(
      db.poll.update({ where: { id }, data: { closedAt: now } }),
      /polls_lifecycle_open_check|polls_close_pair_check/,
    );
    await expectDbError(
      db.poll.update({ where: { id }, data: { status: "CLOSED" } }),
      /polls_lifecycle_decided_check/,
    );
    await expectDbError(
      db.poll.update({ where: { id }, data: { status: "CANCELLED" } }),
      /polls_lifecycle_cancelled_check/,
    );
    await expectDbError(
      db.poll.update({
        where: { id },
        data: { status: "CLOSED", closeReason: "DEADLINE", closedAt: null },
      }),
      /polls_close_pair_check/,
    );
    await expectDbError(
      db.poll.update({
        where: { id },
        data: { status: "CLOSED", closeReason: "MANUAL", closedAt: now },
      }),
      /polls_manual_closer_check/,
    );
    await expectDbError(
      db.poll.update({
        where: { id },
        data: {
          status: "CLOSED",
          closeReason: "DEADLINE",
          closedAt: now,
          closedById: club.admin.id,
        },
      }),
      /polls_manual_closer_check/,
    );
    await expectDbError(
      db.poll.update({ where: { id }, data: { title: "x".repeat(101) } }),
      /polls_title_length_check/,
    );
    await expectDbError(
      db.poll.update({ where: { id }, data: { title: "   " } }),
      /polls_title_length_check/,
    );
    await expectDbError(
      db.poll.update({ where: { id }, data: { theme: "x".repeat(81) } }),
      /polls_theme_length_check/,
    );
    await expectDbError(
      db.poll.update({ where: { id }, data: { description: "x".repeat(5001) } }),
      /polls_description_length_check/,
    );
    await expectDbError(
      db.pollOption.create({
        data: { pollId: id, clubId: club.clubId, category: "DATE", placeId: club.bar },
      }),
      /poll_options_category_check/,
    );
    await expectDbError(
      db.pollOption.create({
        data: {
          pollId: id,
          clubId: club.clubId,
          category: "PLACE",
          placeId: club.hosAnders,
          startsAt: inDays(30),
        },
      }),
      /poll_options_category_check/,
    );
    // A valid cancel and a valid manual close pass.
    await db.poll.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: now, cancelledById: club.admin.id },
    });
    expect((await pollState(id)).status).toBe("CANCELLED");
  });

  it("lader en sted-valgmulighed blokere sletning af stedet (RESTRICT)", async () => {
    await expectDbError(
      db.place.delete({ where: { id: club.hosMads } }),
      /P2003|poll_options_place_id_club_id_fkey|Foreign key|violates RESTRICT/i,
    );
  });
});

// ── createPoll ──────────────────────────────────────────────────────────────

describe("createPoll (§9.7.1, D-134)", () => {
  let club: Club;
  beforeAll(async () => {
    club = await standardClub("R4-opret");
  });

  const base = (overrides: Partial<Parameters<typeof createPoll>[0]> = {}) => ({
    clubId: club.clubId,
    createdById: club.mads.id,
    now: new Date(),
    title: "Ølsmagning #30",
    theme: null,
    description: null,
    deadline: inDays(5),
    dateStartsAt: [inDays(17), inDays(10)],
    places: { existingIds: [club.hosMads, club.bar], newPlace: null },
    ...overrides,
  });

  it("skriver afstemningen og valgmulighederne med clubId", async () => {
    const result = await createPoll(base());
    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    const options = await db.pollOption.findMany({
      where: { pollId: result.id },
      orderBy: [{ category: "asc" }, { startsAt: "asc" }],
    });
    expect(options).toHaveLength(4);
    expect(options.every((option) => option.clubId === club.clubId)).toBe(true);
    expect(options.filter((o) => o.category === "DATE").map((o) => o.startsAt)).toHaveLength(2);
    expect(
      options
        .filter((o) => o.category === "PLACE")
        .map((o) => o.placeId)
        .sort(),
    ).toEqual([club.hosMads, club.bar].sort());
    const ref = await getPollRef(club.clubId, result.id);
    expect(ref).toMatchObject({ status: "OPEN", createdById: club.mads.id });
  });

  it("genbruger et aktivt sted med samme navn til «＋ Nyt sted» (E29) og dedublerer", async () => {
    const result = await createPoll(
      base({
        dateStartsAt: [inDays(10)],
        places: {
          existingIds: [club.hosMads],
          newPlace: { name: " hos  MADS ", address: null, ownedByCreator: false },
        },
      }),
    );
    // The new place IS Hos Mads: one place left, one date → nothing to vote on.
    expect(result).toEqual({ status: "nothing-to-vote" });

    const reused = await createPoll(
      base({
        places: {
          existingIds: [club.bar],
          newPlace: { name: "HOS MADS", address: null, ownedByCreator: false },
        },
      }),
    );
    expect(reused.status).toBe("created");
    if (reused.status !== "created") return;
    const placeIds = await db.pollOption.findMany({
      where: { pollId: reused.id, category: "PLACE" },
      select: { placeId: true },
    });
    expect(placeIds.map((row) => row.placeId).sort()).toEqual([club.hosMads, club.bar].sort());
  });

  it("opretter et nyt sted og ruller det tilbage, når afstemningen afvises", async () => {
    const before = await db.place.count({ where: { clubId: club.clubId } });
    const refused = await createPoll(
      base({
        dateStartsAt: [inDays(10)],
        places: {
          existingIds: [],
          newPlace: { name: "Kun ét sted", address: null, ownedByCreator: true },
        },
      }),
    );
    expect(refused).toEqual({ status: "nothing-to-vote" });
    expect(await db.place.count({ where: { clubId: club.clubId } })).toBe(before);

    const created = await createPoll(
      base({
        places: {
          existingIds: [],
          newPlace: { name: "Kælderen", address: "Vej 1", ownedByCreator: true },
        },
      }),
    );
    expect(created.status).toBe("created");
    const kaelder = await db.place.findFirst({
      where: { clubId: club.clubId, name: "Kælderen" },
      select: { id: true, owners: { select: { userId: true } } },
    });
    expect(kaelder?.owners).toEqual([{ userId: club.mads.id }]);
  });

  it("afviser en anden klubs sted og et arkiveret sted med PlaceNotSelectableError", async () => {
    const other = await standardClub("R4-opret-nabo");
    await expect(
      createPoll(base({ places: { existingIds: [club.bar, other.bar], newPlace: null } })),
    ).rejects.toMatchObject({ name: "PlaceNotSelectableError", reason: "NOT_FOUND" });
    const archived = await place(club.clubId, club.admin, "Lukket", { archived: true });
    const result = await settle(
      createPoll(base({ places: { existingIds: [club.bar, archived], newPlace: null } })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PlaceNotSelectableError);
      expect((result.error as PlaceNotSelectableError).reason).toBe("ARCHIVED");
    }
  });

  it("afviser tidsfejl og et ikke-medlem uden at skrive noget", async () => {
    const before = await countClubPolls(club.clubId);
    const now = new Date();
    expect(await createPoll(base({ dateStartsAt: [new Date(now.getTime() - HOUR)] }))).toEqual({
      status: "timing",
      error: "DATE_PAST",
    });
    expect(await createPoll(base({ deadline: new Date(now.getTime() - MINUTE) }))).toEqual({
      status: "timing",
      error: "DEADLINE_PAST",
    });
    expect(await createPoll(base({ deadline: inDays(11) }))).toEqual({
      status: "timing",
      error: "DEADLINE_NOT_BEFORE_FIRST_DATE",
    });
    const outsider = await person("Udenfor");
    expect(await createPoll(base({ createdById: outsider.id }))).toEqual({ status: "not-member" });
    expect(await countClubPolls(club.clubId)).toBe(before);
  });
});

// ── castBallot ──────────────────────────────────────────────────────────────

describe("castBallot (§9.7.2, E6, E8)", () => {
  let club: Club;
  beforeAll(async () => {
    club = await standardClub("R4-stem");
  });

  const choice = (dateOptionIds: string[], placeOptionId: string | null, noDateWorks = false) => ({
    dateOptionIds,
    placeOptionId,
    noDateWorks,
  });

  it("gemmer en stemme og erstatter alle kryds ved en ændring", async () => {
    const poll = await openPoll(club);
    const [d1, d2] = poll.dateOptionIds as [string, string];
    const [p1, p2] = poll.placeOptionIds as [string, string];
    const first = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: club.mads.id,
      now: new Date(),
      choice: choice([d1, d2], p1),
    });
    expect(first).toEqual({ status: "saved", closed: null });
    const ballot = await db.pollBallot.findFirstOrThrow({
      where: { pollId: poll.pollId, userId: club.mads.id },
      select: { id: true, updatedAt: true },
    });

    const second = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: club.mads.id,
      now: new Date(),
      choice: choice([], p2, true),
    });
    expect(second.status).toBe("saved");
    const after = await db.pollBallot.findFirstOrThrow({
      where: { pollId: poll.pollId, userId: club.mads.id },
      select: {
        id: true,
        noDateWorks: true,
        updatedAt: true,
        votes: { select: { optionId: true } },
      },
    });
    expect(after.id).toBe(ballot.id);
    expect(after.noDateWorks).toBe(true);
    expect(after.votes).toEqual([{ optionId: p2 }]);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(ballot.updatedAt.getTime());

    const view = await getPollView(club.clubId, poll.pollId, club.mads.id);
    expect(view?.myBallot).toMatchObject({
      noDateWorks: true,
      dateOptionIds: [],
      placeOptionId: p2,
    });
    expect(view?.noDateWorksVoters.map((voter) => voter.id)).toEqual([club.mads.id]);
  });

  it("afviser dato + «Ingen passer», en manglende stemme og en fremmed valgmulighed uden at skrive", async () => {
    const poll = await openPoll(club);
    const other = await openPoll(club);
    const [d1] = poll.dateOptionIds as [string];
    const [p1] = poll.placeOptionIds as [string];
    const cast = (c: ReturnType<typeof choice>) =>
      castBallot({
        clubId: club.clubId,
        pollId: poll.pollId,
        userId: club.anders.id,
        now: new Date(),
        choice: c,
      });
    expect(await cast(choice([d1], p1, true))).toEqual({
      status: "invalid",
      errors: { dateOptionIds: "DATE_AND_NONE" },
    });
    expect(await cast(choice([], null))).toEqual({
      status: "invalid",
      errors: { dateOptionIds: "DATE_REQUIRED", placeOptionId: "PLACE_REQUIRED" },
    });
    expect(await cast(choice([other.dateOptionIds[0] as string], p1))).toEqual({
      status: "invalid",
      errors: { dateOptionIds: "UNKNOWN_OPTION" },
    });
    expect(await cast(choice([d1], other.placeOptionIds[0] as string))).toEqual({
      status: "invalid",
      errors: { placeOptionId: "UNKNOWN_OPTION" },
    });
    expect(await db.pollBallot.count({ where: { pollId: poll.pollId } })).toBe(0);
  });

  it("dropper kryds i en fastlagt kategori", async () => {
    const poll = await insertPoll({
      clubId: club.clubId,
      createdById: club.mads.id,
      dates: [inDays(10), inDays(17)],
      placeIds: [club.hosMads],
      deadline: inDays(5),
    });
    const result = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: club.anders.id,
      now: new Date(),
      choice: choice([poll.dateOptionIds[1] as string], poll.placeOptionIds[0] as string),
    });
    expect(result.status).toBe("saved");
    const votes = await db.pollVote.findMany({
      where: { pollId: poll.pollId },
      select: { optionId: true, category: true },
    });
    expect(votes).toEqual([{ optionId: poll.dateOptionIds[1], category: "DATE" }]);
  });

  it("afviser en stemme efter fristen og lukker afstemningen (E6)", async () => {
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
    });
    await expirePoll(poll.pollId);
    const result = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: club.mads.id,
      now: new Date(),
      choice: choice([poll.dateOptionIds[1] as string], poll.placeOptionIds[1] as string),
    });
    expect(result).toEqual({ status: "closed" });
    expect(
      await db.pollBallot.count({ where: { pollId: poll.pollId, userId: club.mads.id } }),
    ).toBe(0);
    const state = await pollState(poll.pollId);
    expect(state).toMatchObject({ status: "CLOSED", closeReason: "DEADLINE", closedById: null });
    // A second vote on the closed poll is refused too.
    expect(
      (
        await castBallot({
          clubId: club.clubId,
          pollId: poll.pollId,
          userId: club.mads.id,
          now: new Date(),
          choice: choice([poll.dateOptionIds[1] as string], poll.placeOptionIds[1] as string),
        })
      ).status,
    ).toBe("closed");
  });

  it("afviser et ikke-medlem og en anden klubs afstemning", async () => {
    const poll = await openPoll(club);
    const outsider = await person("Udenfor");
    const c = choice([poll.dateOptionIds[0] as string], poll.placeOptionIds[0] as string);
    expect(
      await castBallot({
        clubId: club.clubId,
        pollId: poll.pollId,
        userId: outsider.id,
        now: new Date(),
        choice: c,
      }),
    ).toEqual({ status: "not-member" });
    const other = await standardClub("R4-stem-nabo");
    expect(
      await castBallot({
        clubId: other.clubId,
        pollId: poll.pollId,
        userId: other.admin.id,
        now: new Date(),
        choice: c,
      }),
    ).toEqual({ status: "not-found" });
  });

  it("lukker med ALL_VOTED og opretter eventet i samme transaction som den sidste stemme (E8)", async () => {
    const poll = await openPoll(club);
    const [d1, d2] = poll.dateOptionIds as [string, string];
    const [hosMadsOption] = poll.placeOptionIds as [string];
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [d1, hosMadsOption],
    });
    await insertBallot({
      pollId: poll.pollId,
      userId: club.mads.id,
      optionIds: [d1, d2, hosMadsOption],
    });
    const result = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: club.anders.id,
      now: new Date(),
      choice: choice([d1], hosMadsOption),
    });
    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.closed?.status).toBe("CLOSED");
    const state = await pollState(poll.pollId);
    expect(state).toMatchObject({ status: "CLOSED", closeReason: "ALL_VOTED" });
    const [event] = await eventsOfPoll(poll.pollId);
    expect(event?.id).toBe(result.closed?.status === "CLOSED" ? result.closed.eventId : null);
    expect(event).toMatchObject({
      clubId: club.clubId,
      title: "Ølsmagning #20",
      theme: "Juleøl",
      description: "Linje 1\nLinje 2",
      endsAt: null,
      placeId: club.hosMads,
      createdById: club.mads.id,
      pollId: poll.pollId,
    });
    const dateOption = await db.pollOption.findUniqueOrThrow({ where: { id: d1 } });
    expect(event?.startsAt).toEqual(dateOption.startsAt);
    // The winning place's member owner hosts it (§9.7.7).
    expect(event?.hosts).toEqual([{ userId: club.mads.id }]);
    expect((await getEvent(club.clubId, event?.id as string))?.pollId).toBe(poll.pollId);
  });

  it("lader et nyt medlem uden stemme holde afstemningen åben (E12)", async () => {
    const poll = await openPoll(club);
    const [d1] = poll.dateOptionIds as [string];
    const [p1] = poll.placeOptionIds as [string];
    await insertBallot({ pollId: poll.pollId, userId: club.admin.id, optionIds: [d1, p1] });
    await insertBallot({ pollId: poll.pollId, userId: club.mads.id, optionIds: [d1, p1] });
    const newbie = await person("Ny");
    await db.membership.create({
      data: { clubId: club.clubId, userId: newbie.id, role: "MEMBER" },
    });
    const result = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: club.anders.id,
      now: new Date(),
      choice: choice([d1], p1),
    });
    expect(result).toEqual({ status: "saved", closed: null });
    expect((await pollState(poll.pollId)).status).toBe("OPEN");
    // The new member's vote completes it.
    const last = await castBallot({
      clubId: club.clubId,
      pollId: poll.pollId,
      userId: newbie.id,
      now: new Date(),
      choice: choice([d1], p1),
    });
    expect(last.status === "saved" && last.closed?.status).toBe("CLOSED");
    await db.membership.deleteMany({ where: { clubId: club.clubId, userId: newbie.id } });
  });
});

// ── Closing, hosts and ties ─────────────────────────────────────────────────

describe("lukning: værter og uafgjort (§9.7.6, §9.7.7, D-008, D-009, E9–E11)", () => {
  it("gør opretteren til vært, når vinderstedet ingen ejere har (E10)", async () => {
    const club = await standardClub("R4-vaert");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[1] as string],
    });
    const outcome = await closePollManually({
      clubId: club.clubId,
      pollId: poll.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    expect(outcome.status).toBe("closed");
    expect(await pollState(poll.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "MANUAL",
      closedById: club.admin.id,
    });
    const [event] = await eventsOfPoll(poll.pollId);
    expect(event?.placeId).toBe(club.bar);
    expect(event?.hosts).toEqual([{ userId: club.mads.id }]);
    expect(event?.createdById).toBe(club.mads.id);
  });

  it("gør den handlende admin til vært, når opretteren har forladt klubben (E11)", async () => {
    const club = await standardClub("R4-e11");
    const poll = await openPoll(club, { createdById: club.anders.id });
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[1] as string],
    });
    expect(
      (await leaveClub({ clubId: club.clubId, userId: club.anders.id, now: new Date() })).ok,
    ).toBe(true);
    // The creator who left may no longer manage it.
    expect(
      await closePollManually({
        clubId: club.clubId,
        pollId: poll.pollId,
        actorUserId: club.anders.id,
        now: new Date(),
      }),
    ).toEqual({ status: "forbidden" });
    const result = await closePollManually({
      clubId: club.clubId,
      pollId: poll.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    expect(result.status).toBe("closed");
    const [event] = await eventsOfPoll(poll.pollId);
    expect(event?.hosts).toEqual([{ userId: club.admin.id }]);
    expect(event?.createdById).toBe(club.anders.id);
  });

  it("giver ingen vært ved automatisk lukning, når opretteren er væk og stedet ingen ejere har (E34)", async () => {
    const club = await standardClub("R4-e34");
    const poll = await openPoll(club, { createdById: club.anders.id });
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[1] as string],
    });
    await leaveClub({ clubId: club.clubId, userId: club.anders.id, now: new Date() });
    await expirePoll(poll.pollId);
    expect((await closePollIfDue(club.clubId, poll.pollId, new Date()))?.status).toBe("CLOSED");
    const [event] = await eventsOfPoll(poll.pollId);
    expect(event?.hosts).toEqual([]);
  });

  it("går i AWAITING_DECISION uden event ved 0 stemmer (E9) og ved uafgjort", async () => {
    const club = await standardClub("R4-uafgjort");
    const empty = await openPoll(club);
    await expirePoll(empty.pollId);
    expect(await closePollIfDue(club.clubId, empty.pollId, new Date())).toEqual({
      status: "AWAITING_DECISION",
      tied: ["DATE", "PLACE"],
    });
    expect(await eventsOfPoll(empty.pollId)).toEqual([]);
    expect(await pollState(empty.pollId)).toMatchObject({
      status: "AWAITING_DECISION",
      closeReason: "DEADLINE",
    });

    const tied = await openPoll(club);
    const [d1] = tied.dateOptionIds as [string];
    const [p1, p2] = tied.placeOptionIds as [string, string];
    await insertBallot({ pollId: tied.pollId, userId: club.admin.id, optionIds: [d1, p1] });
    await insertBallot({ pollId: tied.pollId, userId: club.mads.id, optionIds: [d1, p2] });
    const closed = await closePollManually({
      clubId: club.clubId,
      pollId: tied.pollId,
      actorUserId: club.mads.id,
      now: new Date(),
    });
    expect(closed).toEqual({
      status: "closed",
      outcome: { status: "AWAITING_DECISION", tied: ["PLACE"] },
    });
    const view = await getPollView(club.clubId, tied.pollId, club.admin.id);
    expect(view?.tiedCategories).toEqual(["PLACE"]);
    expect(view?.winners).toEqual({ DATE: d1, PLACE: null });

    // A member who is not the creator may not choose.
    expect(
      await resolvePollTie({
        clubId: club.clubId,
        pollId: tied.pollId,
        actorUserId: club.anders.id,
        now: new Date(),
        choices: { PLACE: p1 },
      }),
    ).toEqual({ status: "forbidden" });
    // A non-tied option (the date category is decided) → invalid, nothing written.
    expect(
      await resolvePollTie({
        clubId: club.clubId,
        pollId: tied.pollId,
        actorUserId: club.admin.id,
        now: new Date(),
        choices: { DATE: d1, PLACE: p1 },
      }),
    ).toEqual({ status: "invalid-choice", categories: ["DATE"] });
    expect(
      await resolvePollTie({
        clubId: club.clubId,
        pollId: tied.pollId,
        actorUserId: club.admin.id,
        now: new Date(),
        choices: {},
      }),
    ).toEqual({ status: "invalid-choice", categories: ["PLACE"] });
    expect(await db.pollTieResolution.count({ where: { pollId: tied.pollId } })).toBe(0);

    const resolved = await resolvePollTie({
      clubId: club.clubId,
      pollId: tied.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
      choices: { PLACE: p2 },
    });
    expect(resolved.status).toBe("closed");
    expect((await pollState(tied.pollId)).status).toBe("CLOSED");
    expect(
      await db.pollTieResolution.findMany({
        where: { pollId: tied.pollId },
        select: { category: true, chosenOptionId: true, chosenById: true },
      }),
    ).toEqual([{ category: "PLACE", chosenOptionId: p2, chosenById: club.admin.id }]);
    const [event] = await eventsOfPoll(tied.pollId);
    expect(event?.placeId).toBe(club.bar);
    const after = await getPollView(club.clubId, tied.pollId, club.admin.id);
    expect(after?.winners).toEqual({ DATE: d1, PLACE: p2 });
    expect(after?.event?.id).toBe(event?.id);

    expect(
      await resolvePollTie({
        clubId: club.clubId,
        pollId: tied.pollId,
        actorUserId: club.admin.id,
        now: new Date(),
        choices: { PLACE: p2 },
      }),
    ).toEqual({ status: "not-awaiting" });
  });

  it("er idempotent: lukning af en lukket afstemning gør intet (E7)", async () => {
    const club = await standardClub("R4-idempotent");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
    });
    await expirePoll(poll.pollId);
    expect((await closePollIfDue(club.clubId, poll.pollId, new Date()))?.status).toBe("CLOSED");
    expect(await closePollIfDue(club.clubId, poll.pollId, new Date())).toBeNull();
    expect(
      await closePollManually({
        clubId: club.clubId,
        pollId: poll.pollId,
        actorUserId: club.admin.id,
        now: new Date(),
      }),
    ).toEqual({ status: "already-final" });
    expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
  });
});

// ── cancel and edit ─────────────────────────────────────────────────────────

describe("cancelPoll og updatePoll (D-133, E24)", () => {
  let club: Club;
  beforeAll(async () => {
    club = await standardClub("R4-annuller");
  });

  it("annullerer fra OPEN og fra AWAITING_DECISION (closedAt bevares), ikke efter CLOSED", async () => {
    const open = await openPoll(club);
    await insertBallot({
      pollId: open.pollId,
      userId: club.admin.id,
      optionIds: [open.dateOptionIds[0] as string, open.placeOptionIds[0] as string],
    });
    expect(
      await cancelPoll({
        clubId: club.clubId,
        pollId: open.pollId,
        actorUserId: club.anders.id,
        now: new Date(),
      }),
    ).toEqual({ status: "forbidden" });
    expect(
      await cancelPoll({
        clubId: club.clubId,
        pollId: open.pollId,
        actorUserId: club.mads.id,
        now: new Date(),
      }),
    ).toEqual({ status: "cancelled" });
    expect(await pollState(open.pollId)).toMatchObject({
      status: "CANCELLED",
      cancelledById: club.mads.id,
      closedAt: null,
    });
    // Ballots are kept; no event.
    expect(await db.pollBallot.count({ where: { pollId: open.pollId } })).toBe(1);
    expect(await eventsOfPoll(open.pollId)).toEqual([]);

    const awaiting = await openPoll(club);
    await expirePoll(awaiting.pollId);
    await closePollIfDue(club.clubId, awaiting.pollId, new Date());
    const closedAt = (await pollState(awaiting.pollId)).closedAt;
    expect(closedAt).not.toBeNull();
    expect(
      await cancelPoll({
        clubId: club.clubId,
        pollId: awaiting.pollId,
        actorUserId: club.admin.id,
        now: new Date(),
      }),
    ).toEqual({ status: "cancelled" });
    expect(await pollState(awaiting.pollId)).toMatchObject({
      status: "CANCELLED",
      closeReason: "DEADLINE",
      closedAt,
    });

    const closed = await openPoll(club);
    await insertBallot({
      pollId: closed.pollId,
      userId: club.admin.id,
      optionIds: [closed.dateOptionIds[0] as string, closed.placeOptionIds[0] as string],
    });
    await closePollManually({
      clubId: club.clubId,
      pollId: closed.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    expect(
      await cancelPoll({
        clubId: club.clubId,
        pollId: closed.pollId,
        actorUserId: club.admin.id,
        now: new Date(),
      }),
    ).toEqual({ status: "already-final" });
  });

  it("forlænger fristen og beholder stemmerne (E24), men afviser kortere frist og frist efter første dato", async () => {
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
    });
    const current = (await getPollRef(club.clubId, poll.pollId))?.deadline as Date;
    const edit = (overrides: Partial<Parameters<typeof updatePoll>[0]> = {}) =>
      updatePoll({
        clubId: club.clubId,
        pollId: poll.pollId,
        actorUserId: club.mads.id,
        now: new Date(),
        title: "Ny titel",
        theme: null,
        description: "Ny plan",
        deadline: new Date(current.getTime() + DAY),
        options: null,
        ...overrides,
      });
    expect(await edit({ actorUserId: club.anders.id })).toEqual({ status: "forbidden" });
    expect(await edit({ deadline: new Date(current.getTime() - HOUR) })).toEqual({
      status: "timing",
      error: "DEADLINE_SHORTENED",
    });
    expect(await edit({ deadline: inDays(12) })).toEqual({
      status: "timing",
      error: "DEADLINE_NOT_BEFORE_FIRST_DATE",
    });
    expect(await edit()).toEqual({ status: "updated" });
    const row = await db.poll.findUniqueOrThrow({ where: { id: poll.pollId } });
    expect(row).toMatchObject({ title: "Ny titel", theme: null, description: "Ny plan" });
    expect(row.deadline).toEqual(new Date(current.getTime() + DAY));
    expect(await db.pollBallot.count({ where: { pollId: poll.pollId } })).toBe(1);
    // Admins may edit too.
    expect(await edit({ actorUserId: club.admin.id, deadline: row.deadline })).toEqual({
      status: "updated",
    });
  });

  it("svarer closed for en lukket afstemning og lukker en udløbet", async () => {
    const poll = await openPoll(club);
    await expirePoll(poll.pollId);
    const result = await updatePoll({
      clubId: club.clubId,
      pollId: poll.pollId,
      actorUserId: club.mads.id,
      now: new Date(),
      title: "For sent",
      theme: null,
      description: null,
      deadline: inDays(6),
      options: null,
    });
    expect(result).toEqual({ status: "closed" });
    expect((await pollState(poll.pollId)).status).toBe("AWAITING_DECISION");
    expect((await db.poll.findUniqueOrThrow({ where: { id: poll.pollId } })).title).not.toBe(
      "For sent",
    );
  });
});

// ── Edit the options while nobody has voted (D-153) ─────────────────────────

describe("updatePoll med datoer og steder (D-153)", () => {
  let club: Club;
  beforeAll(async () => {
    club = await standardClub("R4-ret-valg");
  });

  type Edit = Parameters<typeof updatePoll>[0];
  const edit = (pollId: string, overrides: Partial<Edit> = {}) =>
    updatePoll({
      clubId: club.clubId,
      pollId,
      actorUserId: club.mads.id,
      now: new Date(),
      title: "Ølsmagning #21",
      theme: "Porter",
      description: null,
      deadline: inDays(4),
      options: {
        dateStartsAt: [inDays(10), inDays(24)],
        places: { existingIds: [club.bar, club.hosAnders], newPlace: null },
      },
      ...overrides,
    });

  /** The poll's options and texts, to prove that nothing changed. */
  async function snapshot(pollId: string) {
    const [poll, options] = await Promise.all([
      db.poll.findUniqueOrThrow({
        where: { id: pollId },
        select: { title: true, theme: true, description: true, deadline: true, status: true },
      }),
      db.pollOption.findMany({
        where: { pollId },
        select: { id: true, clubId: true, category: true, startsAt: true, placeId: true },
        orderBy: { id: "asc" },
      }),
    ]);
    return { poll, options };
  }

  it("0 stemmer: tilføjer, fjerner og ændrer datoer og steder; uændrede beholder deres id", async () => {
    const before = await openPoll(club);
    const kept = (
      await db.pollOption.findUniqueOrThrow({
        where: { id: before.dateOptionIds[0] as string },
        select: { startsAt: true },
      })
    ).startsAt as Date;
    const added = inDays(24);
    // +10 is kept, +17 goes, +24 comes; Baren stays, Hos Mads goes, Hos Anders comes.
    // Repeats count once, and the deadline may move EARLIER (+5 → +4): nobody has voted.
    expect(
      await edit(before.pollId, {
        deadline: inDays(4),
        options: {
          dateStartsAt: [added, kept, added],
          places: { existingIds: [club.hosAnders, club.bar, club.bar], newPlace: null },
        },
      }),
    ).toEqual({ status: "updated" });

    const after = await snapshot(before.pollId);
    expect(after.poll).toMatchObject({ title: "Ølsmagning #21", theme: "Porter", status: "OPEN" });
    expect(after.poll.deadline.getTime()).toBeLessThan(inDays(4.5).getTime());
    const dateRows = after.options.filter((o) => o.category === "DATE");
    const placeRows = after.options.filter((o) => o.category === "PLACE");
    expect(dateRows.map((o) => o.startsAt?.getTime()).sort()).toEqual(
      [kept.getTime(), added.getTime()].sort(),
    );
    expect(dateRows.find((o) => o.startsAt?.getTime() === kept.getTime())?.id).toBe(
      before.dateOptionIds[0],
    );
    expect(placeRows.map((o) => o.placeId).sort()).toEqual([club.bar, club.hosAnders].sort());
    expect(placeRows.find((o) => o.placeId === club.bar)?.id).toBe(before.placeOptionIds[1]);
    expect(after.options.every((o) => o.clubId === club.clubId)).toBe(true);
    const ids = after.options.map((o) => o.id);
    expect(ids).not.toContain(before.dateOptionIds[1]);
    expect(ids).not.toContain(before.placeOptionIds[0]);

    // The poll page and E5 follow the new options.
    const view = await getPollView(club.clubId, before.pollId, club.mads.id);
    expect(view?.places.map((p) => p.place.id).sort()).toEqual([club.bar, club.hosAnders].sort());
    expect(view?.dates.map((d) => d.startsAt.getTime())).toEqual([kept.getTime(), added.getTime()]);
    expect((await getPlaceUsage(club.clubId, club.hosAnders)).activePollCount).toBeGreaterThan(0);
  });

  it("0 stemmer: «＋ Nyt sted» oprettes med den, der retter, som ejer – eller genbruges ved navn (E29)", async () => {
    const poll = await openPoll(club);
    expect(
      await edit(poll.pollId, {
        actorUserId: club.admin.id,
        options: {
          dateStartsAt: [inDays(10)],
          places: {
            existingIds: [club.hosMads],
            newPlace: { name: "Haven", address: "Havevej 2", ownedByCreator: true },
          },
        },
      }),
    ).toEqual({ status: "updated" });
    const haven = await db.place.findFirstOrThrow({
      where: { clubId: club.clubId, name: "Haven" },
      select: { id: true, createdById: true, owners: { select: { userId: true } } },
    });
    expect(haven.createdById).toBe(club.admin.id);
    expect(haven.owners).toEqual([{ userId: club.admin.id }]);
    const placeIds = await db.pollOption.findMany({
      where: { pollId: poll.pollId, category: "PLACE" },
      select: { placeId: true },
    });
    expect(placeIds.map((row) => row.placeId).sort()).toEqual([club.hosMads, haven.id].sort());

    // The same name again reuses the place; with one date and one place left → nothing to vote on.
    const placesBefore = await db.place.count({ where: { clubId: club.clubId } });
    expect(
      await edit(poll.pollId, {
        options: {
          dateStartsAt: [inDays(10)],
          places: {
            existingIds: [haven.id],
            newPlace: { name: " haven ", address: null, ownedByCreator: false },
          },
        },
      }),
    ).toEqual({ status: "nothing-to-vote" });
    expect(await db.place.count({ where: { clubId: club.clubId } })).toBe(placesBefore);
  });

  it("1 stemme: options-locked og intet ændret – også når stemmen er et tidligere medlems", async () => {
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      userId: club.anders.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
    });
    const before = await snapshot(poll.pollId);
    const placesBefore = await db.place.count({ where: { clubId: club.clubId } });
    expect(
      await edit(poll.pollId, {
        options: {
          dateStartsAt: [inDays(10), inDays(24)],
          places: {
            existingIds: [club.bar],
            newPlace: { name: "Aldrig oprettet", address: null, ownedByCreator: true },
          },
        },
      }),
    ).toEqual({ status: "options-locked" });
    expect(await snapshot(poll.pollId)).toEqual(before);
    expect(await db.place.count({ where: { clubId: club.clubId } })).toBe(placesBefore);

    // Title, theme, description and a later deadline still work after a vote (E24).
    expect(
      await edit(poll.pollId, { title: "Kun titlen", deadline: inDays(6), options: null }),
    ).toEqual({ status: "updated" });
    const after = await snapshot(poll.pollId);
    expect(after.poll.title).toBe("Kun titlen");
    expect(after.options).toEqual(before.options);
    expect(await db.pollBallot.count({ where: { pollId: poll.pollId } })).toBe(1);

    // A ballot whose voter is no longer a member still freezes the options.
    const former = await person("Tidligere medlem");
    await db.membership.create({
      data: { clubId: club.clubId, userId: former.id, role: "MEMBER" },
    });
    const other = await openPoll(club);
    await insertBallot({
      pollId: other.pollId,
      userId: former.id,
      optionIds: [other.dateOptionIds[1] as string, other.placeOptionIds[1] as string],
    });
    await db.membership.deleteMany({ where: { clubId: club.clubId, userId: former.id } });
    const frozen = await snapshot(other.pollId);
    expect(await edit(other.pollId)).toEqual({ status: "options-locked" });
    expect(await snapshot(other.pollId)).toEqual(frozen);
  });

  it("afviser intet at stemme om, over 10, arkiverede og andre klubbers steder og tidsfejl uden at skrive", async () => {
    const poll = await openPoll(club);
    const before = await snapshot(poll.pollId);
    const placesBefore = await db.place.count({ where: { clubId: club.clubId } });
    const opts = (dateStartsAt: Date[], existingIds: string[]) => ({
      dateStartsAt,
      places: { existingIds, newPlace: null },
    });

    expect(await edit(poll.pollId, { options: opts([inDays(10)], [club.bar]) })).toEqual({
      status: "nothing-to-vote",
    });
    const eleven = Array.from({ length: 11 }, (_, i) => inDays(10 + i));
    expect(await edit(poll.pollId, { options: opts(eleven, [club.bar]) })).toEqual({
      status: "nothing-to-vote",
    });
    const many: string[] = [];
    for (let i = 0; i < 11; i += 1) many.push(await place(club.clubId, club.admin, `Mange ${i}`));
    expect(await edit(poll.pollId, { options: opts([inDays(10), inDays(17)], many) })).toEqual({
      status: "nothing-to-vote",
    });

    const archived = await place(club.clubId, club.admin, "Lukket sted", { archived: true });
    await expect(
      edit(poll.pollId, { options: opts([inDays(10), inDays(17)], [club.bar, archived]) }),
    ).rejects.toMatchObject({ name: "PlaceNotSelectableError", reason: "ARCHIVED" });

    // Another club's place → NOT_FOUND, and the new place from the same edit is rolled back.
    const other = await standardClub("R4-ret-valg-nabo");
    const withNew = await settle(
      edit(poll.pollId, {
        options: {
          dateStartsAt: [inDays(10), inDays(17)],
          places: {
            existingIds: [other.bar],
            newPlace: { name: "Rulles tilbage", address: null, ownedByCreator: true },
          },
        },
      }),
    );
    expect(withNew.ok).toBe(false);
    if (!withNew.ok) {
      expect(withNew.error).toBeInstanceOf(PlaceNotSelectableError);
      expect((withNew.error as PlaceNotSelectableError).reason).toBe("NOT_FOUND");
    }
    expect(await db.place.count({ where: { name: "Rulles tilbage" } })).toBe(0);

    expect(
      await edit(poll.pollId, {
        options: opts([new Date(Date.now() - HOUR), inDays(17)], [club.bar]),
      }),
    ).toEqual({ status: "timing", error: "DATE_PAST" });
    expect(
      await edit(poll.pollId, {
        deadline: inDays(12),
        options: opts([inDays(11), inDays(17)], [club.bar]),
      }),
    ).toEqual({ status: "timing", error: "DEADLINE_NOT_BEFORE_FIRST_DATE" });
    expect(
      await edit(poll.pollId, {
        deadline: new Date(Date.now() - MINUTE),
        options: opts([inDays(11), inDays(17)], [club.bar]),
      }),
    ).toEqual({ status: "timing", error: "DEADLINE_PAST" });

    expect(await snapshot(poll.pollId)).toEqual(before);
    expect(await db.place.count({ where: { clubId: club.clubId } })).toBe(placesBefore + 12);
  });

  it("svarer forbidden for et almindeligt medlem, not-found for en anden klubs afstemning og closed efter fristen", async () => {
    const poll = await openPoll(club);
    const before = await snapshot(poll.pollId);
    expect(await edit(poll.pollId, { actorUserId: club.anders.id })).toEqual({
      status: "forbidden",
    });
    const other = await standardClub("R4-ret-valg-isolation");
    const foreign = await openPoll(other);
    expect(await edit(foreign.pollId)).toEqual({ status: "not-found" });
    expect(
      await updatePoll({
        clubId: other.clubId,
        pollId: poll.pollId,
        actorUserId: other.admin.id,
        now: new Date(),
        title: "Kapret",
        theme: null,
        description: null,
        deadline: inDays(4),
        options: null,
      }),
    ).toEqual({ status: "not-found" });
    expect(await snapshot(poll.pollId)).toEqual(before);

    await expirePoll(poll.pollId);
    expect(await edit(poll.pollId)).toEqual({ status: "closed" });
    expect((await pollState(poll.pollId)).status).not.toBe("OPEN");
  });
});

// ── Lazy close and cron ─────────────────────────────────────────────────────

describe("closeDuePolls og cron (§9.7.5, D-131)", () => {
  it("lukker ved frist og når alle har stemt, men ikke når et nyt medlem mangler eller fristen er forlænget", async () => {
    const club = await standardClub("R4-lazy");
    const vote = (pollId: string, userId: string, dateId: string, placeId: string) =>
      insertBallot({ pollId, userId, optionIds: [dateId, placeId] });

    const expired = await openPoll(club);
    await expirePoll(expired.pollId);

    const allVoted = await openPoll(club);
    for (const user of [club.admin, club.mads, club.anders]) {
      await vote(
        allVoted.pollId,
        user.id,
        allVoted.dateOptionIds[0] as string,
        allVoted.placeOptionIds[0] as string,
      );
    }

    const notDue = await openPoll(club);
    await vote(
      notDue.pollId,
      club.admin.id,
      notDue.dateOptionIds[0] as string,
      notDue.placeOptionIds[0] as string,
    );

    const result = await closeDuePolls(club.clubId, new Date());
    expect(result).toEqual({ closed: 1, awaiting: 1, failed: 0 });
    expect((await pollState(expired.pollId)).status).toBe("AWAITING_DECISION");
    expect(await pollState(allVoted.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "ALL_VOTED",
    });
    expect((await pollState(notDue.pollId)).status).toBe("OPEN");

    // E12: a new member without a ballot keeps a fully voted poll open.
    const newbie = await person("Ny i lazy");
    await db.membership.create({
      data: { clubId: club.clubId, userId: newbie.id, role: "MEMBER" },
    });
    const blocked = await openPoll(club);
    for (const user of [club.admin, club.mads, club.anders]) {
      await vote(
        blocked.pollId,
        user.id,
        blocked.dateOptionIds[0] as string,
        blocked.placeOptionIds[0] as string,
      );
    }
    expect(await closeDuePolls(club.clubId, new Date())).toEqual({
      closed: 0,
      awaiting: 0,
      failed: 0,
    });
    expect((await pollState(blocked.pollId)).status).toBe("OPEN");
    // A former member's leave can complete it (the next view closes it, C18).
    await leaveClub({ clubId: club.clubId, userId: newbie.id, now: new Date() });
    expect((await closeDuePolls(club.clubId, new Date())).closed).toBe(1);

    // An extended deadline is not due.
    const extended = await openPoll(club);
    await db.poll.update({ where: { id: extended.pollId }, data: { deadline: inDays(6) } });
    expect(await closePollIfDue(club.clubId, extended.pollId, new Date())).toBeNull();
  });

  it("cron-ruten kræver Bearer CRON_SECRET og lukker forfaldne afstemninger på tværs af klubber", async () => {
    const one = await standardClub("R4-cron-1");
    const two = await standardClub("R4-cron-2");
    const a = await openPoll(one);
    const b = await openPoll(two);
    await expirePoll(a.pollId);
    await expirePoll(b.pollId);

    const unauthorized = await cronGET(new Request("http://localhost/api/cron/close-polls"));
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "Ikke autoriseret" });
    const wrong = await cronGET(
      new Request("http://localhost/api/cron/close-polls", {
        headers: { authorization: "Bearer forkert-hemmelighed-123456" },
      }),
    );
    expect(wrong.status).toBe(401);

    const secret = process.env.CRON_SECRET as string;
    expect(secret?.length).toBeGreaterThanOrEqual(16);
    const response = await cronGET(
      new Request("http://localhost/api/cron/close-polls", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, number>;
    expect(body.awaiting).toBeGreaterThanOrEqual(2);
    expect(body.failed).toBe(0);
    expect((await pollState(a.pollId)).status).toBe("AWAITING_DECISION");
    expect((await pollState(b.pollId)).status).toBe("AWAITING_DECISION");

    const again = await closeAllDuePolls(new Date());
    expect(again.touchedClubIds).not.toContain(one.clubId);
    expect(again.touchedClubIds).not.toContain(two.clubId);
  });
});

// ── Memberships and deleting a club ─────────────────────────────────────────

describe("medlemskaber og sletning af klubben (§7.4, §7.5, D-130)", () => {
  it("sletter kun stemmer i ÅBNE afstemninger, når man forlader klubben", async () => {
    const club = await standardClub("R4-forlad");
    const open = await openPoll(club);
    const awaiting = await openPoll(club);
    const closed = await openPoll(club);
    const cancelled = await openPoll(club);
    for (const poll of [open, awaiting, closed, cancelled]) {
      await insertBallot({
        pollId: poll.pollId,
        userId: club.anders.id,
        optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
      });
    }
    await expirePoll(awaiting.pollId);
    await db.pollBallot.deleteMany({ where: { pollId: awaiting.pollId } });
    await insertBallot({
      pollId: awaiting.pollId,
      userId: club.anders.id,
      optionIds: [awaiting.dateOptionIds[0] as string, awaiting.placeOptionIds[0] as string],
    });
    await insertBallot({
      pollId: awaiting.pollId,
      userId: club.mads.id,
      optionIds: [awaiting.dateOptionIds[1] as string, awaiting.placeOptionIds[1] as string],
    });
    expect((await closePollIfDue(club.clubId, awaiting.pollId, new Date()))?.status).toBe(
      "AWAITING_DECISION",
    );
    await closePollManually({
      clubId: club.clubId,
      pollId: closed.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    await cancelPoll({
      clubId: club.clubId,
      pollId: cancelled.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });

    expect(
      (await leaveClub({ clubId: club.clubId, userId: club.anders.id, now: new Date() })).ok,
    ).toBe(true);
    const left = async (pollId: string) =>
      db.pollBallot.count({ where: { pollId, userId: club.anders.id } });
    expect(await left(open.pollId)).toBe(0);
    expect(await left(awaiting.pollId)).toBe(1);
    expect(await left(closed.pollId)).toBe(1);
    expect(await left(cancelled.pollId)).toBe(1);
    // History: the former member's ballot still shows, as a former member.
    const view = await getPollView(club.clubId, closed.pollId, club.admin.id);
    expect(view?.dates[0]?.voters.find((v) => v.id === club.anders.id)?.isMember).toBe(false);
    expect(view?.missingMembers.map((m) => m.id)).not.toContain(club.anders.id);
  });

  it("sletter en klub med afstemninger, events fra afstemninger og steder brugt som valgmuligheder", async () => {
    const club = await standardClub("R4-slet");
    const other = await standardClub("R4-slet-nabo");
    const kept = await openPoll(other);
    const open = await openPoll(club);
    const decided = await openPoll(club);
    await insertBallot({
      pollId: decided.pollId,
      userId: club.admin.id,
      optionIds: [decided.dateOptionIds[0] as string, decided.placeOptionIds[0] as string],
    });
    await closePollManually({
      clubId: club.clubId,
      pollId: decided.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    expect(await eventsOfPoll(decided.pollId)).toHaveLength(1);
    expect((await getClubContentCounts(club.clubId)).polls).toBe(2);

    const result = await deleteClub({
      clubId: club.clubId,
      actorUserId: club.admin.id,
      confirmName: "R4-slet",
    });
    expect(result).toEqual({ ok: true });
    expect(await db.club.count({ where: { id: club.clubId } })).toBe(0);
    expect(await db.poll.count({ where: { id: { in: [open.pollId, decided.pollId] } } })).toBe(0);
    expect(await db.pollOption.count({ where: { clubId: club.clubId } })).toBe(0);
    expect(await db.place.count({ where: { clubId: club.clubId } })).toBe(0);
    expect(await db.user.count({ where: { id: club.mads.id } })).toBe(1);
    expect((await pollState(kept.pollId)).status).toBe("OPEN");
  });
});

// ── E5: places in polls ─────────────────────────────────────────────────────

describe("steder i afstemninger (E5, D-132)", () => {
  it("blokerer fjernelse i OPEN og AWAITING, arkiverer efter CLOSED/CANCELLED og sletter ubrugte", async () => {
    const club = await standardClub("R4-e5");
    const remove = (placeId: string) =>
      removePlace({
        clubId: club.clubId,
        placeId,
        actorUserId: club.admin.id,
        actorRole: "ADMIN",
      });

    const open = await openPoll(club);
    expect(await getPlaceUsage(club.clubId, club.bar)).toEqual({
      eventCount: 0,
      pollOptionCount: 1,
      activePollCount: 1,
    });
    const blocked = await remove(club.bar);
    expect(blocked).toEqual({
      status: "in-active-poll",
      poll: { id: open.pollId, title: "Ølsmagning #20" },
    });
    const detail = await getPlace(club.clubId, club.bar);
    expect(detail?.activePolls).toEqual([{ id: open.pollId, title: "Ølsmagning #20" }]);
    expect(detail?.pollOptionCount).toBe(1);

    await expirePoll(open.pollId);
    await closePollIfDue(club.clubId, open.pollId, new Date());
    expect((await pollState(open.pollId)).status).toBe("AWAITING_DECISION");
    expect((await remove(club.bar)).status).toBe("in-active-poll");

    await cancelPoll({
      clubId: club.clubId,
      pollId: open.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    // Only in a cancelled poll: archived, never deleted (poll_options RESTRICT).
    expect(await remove(club.bar)).toEqual({ status: "archived" });
    expect(
      (await db.place.findUniqueOrThrow({ where: { id: club.bar } })).archivedAt,
    ).not.toBeNull();

    const unused = await place(club.clubId, club.admin, "Aldrig brugt");
    expect(await remove(unused)).toEqual({ status: "deleted" });
  });
});

// ── Scoping and queries ─────────────────────────────────────────────────────

describe("forespørgsler og klub-isolation (§4.4)", () => {
  it("giver null/[] for en anden klub og viser afstemningen i sin egen", async () => {
    const club = await standardClub("R4-scope");
    const other = await standardClub("R4-scope-nabo");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      userId: club.admin.id,
      optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
    });

    expect(await getPollRef(other.clubId, poll.pollId)).toBeNull();
    expect(await getPollRef(club.clubId, "ikke-et-id")).toBeNull();
    expect(await getPollView(other.clubId, poll.pollId, other.admin.id)).toBeNull();
    expect(await listOverviewPolls(other.clubId, other.admin.id, new Date())).toEqual([]);
    expect(await listPollDateOptions(other.clubId, other.admin.id, { from: new Date() })).toEqual(
      [],
    );

    const view = await getPollView(club.clubId, poll.pollId, club.mads.id);
    expect(view).toMatchObject({
      status: "OPEN",
      shape: { DATE: "vote", PLACE: "vote" },
      ballotCount: 1,
      votedMemberIds: [club.admin.id],
      myBallot: null,
    });
    expect(view?.missingMembers.map((m) => m.name).sort()).toEqual(["Anders", "Mads"]);
    expect(view?.places.map((p) => p.place.name)).toEqual(["Baren", "Hos Mads"]);
    expect(view?.places.find((p) => p.place.name === "Hos Mads")?.place.ownerIds).toEqual([
      club.mads.id,
    ]);
    expect(view?.dates[0]).toMatchObject({ count: 1, isLeader: true, viewerTicked: false });

    const overview = await listOverviewPolls(club.clubId, club.mads.id, new Date());
    expect(overview).toEqual([
      expect.objectContaining({
        id: poll.pollId,
        status: "OPEN",
        viewerHasVoted: false,
        votedCount: 1,
        memberCount: 3,
        creatorName: "Mads",
      }),
    ]);
    expect(
      (await listOverviewPolls(club.clubId, club.admin.id, new Date()))[0]?.viewerHasVoted,
    ).toBe(true);

    const calendar = await listPollDateOptions(club.clubId, club.admin.id, { from: new Date() });
    expect(calendar.map((option) => option.optionId)).toEqual(poll.dateOptionIds);
    expect(calendar.map((option) => option.viewerTicked)).toEqual([true, false]);

    // Title suggestions count active polls (D-137).
    expect(await getSuggestedPollTitle(club.clubId)).toBe("Ølsmagning #21");
    expect(await getSuggestedEventTitle(club.clubId)).toBe("Ølsmagning #21");
    expect(await listRecentEventStarts(club.clubId)).toEqual([]);

    // CLOSED: on Overblik while its event is coming; gone from the calendar.
    await closePollManually({
      clubId: club.clubId,
      pollId: poll.pollId,
      actorUserId: club.admin.id,
      now: new Date(),
    });
    const [closedItem] = await listOverviewPolls(club.clubId, club.mads.id, new Date());
    expect(closedItem).toMatchObject({ status: "CLOSED", event: { placeName: "Hos Mads" } });
    expect(closedItem?.event?.hostNames).toEqual(["Mads"]);
    expect(await listPollDateOptions(club.clubId, club.admin.id, { from: new Date() })).toEqual([]);
    expect(await listRecentEventStarts(club.clubId)).toHaveLength(1);
  });
});

// ── Concurrency ─────────────────────────────────────────────────────────────

describe("samtidighed under poll-låsen (D-130)", () => {
  it(`1: 5× closePollIfDue på en udløbet afstemning giver præcis ét event (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-1");
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await openPoll(club);
      await insertBallot({
        pollId: poll.pollId,
        userId: club.admin.id,
        optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
      });
      await expirePoll(poll.pollId);
      const now = new Date();
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          staggered(round + i, () => closePollIfDue(club.clubId, poll.pollId, now)),
        ),
      );
      expect(results.filter((r) => r?.status === "CLOSED")).toHaveLength(1);
      expect(results.filter((r) => r === null)).toHaveLength(4);
      expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
      expect(await pollState(poll.pollId)).toMatchObject({
        status: "CLOSED",
        closeReason: "DEADLINE",
      });
    }
  });

  it(`2: closePollManually ‖ closeDuePolls ‖ closeAllDuePolls giver ét event (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-2");
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await openPoll(club);
      await insertBallot({
        pollId: poll.pollId,
        userId: club.admin.id,
        optionIds: [poll.dateOptionIds[1] as string, poll.placeOptionIds[1] as string],
      });
      await expirePoll(poll.pollId);
      const now = new Date();
      const [manual, lazy, cron] = await Promise.all([
        staggered(round, () =>
          closePollManually({
            clubId: club.clubId,
            pollId: poll.pollId,
            actorUserId: club.admin.id,
            now,
          }),
        ),
        staggered(round + 2, () => closeDuePolls(club.clubId, now)),
        staggered(round + 4, () => closeAllDuePolls(now)),
      ]);
      expect(lazy.failed).toBe(0);
      expect(cron.failed).toBe(0);
      const closers =
        (manual.status === "closed" ? 1 : 0) +
        lazy.closed +
        (cron.touchedClubIds.includes(club.clubId) ? 1 : 0);
      expect(closers).toBe(1);
      expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
    }
  });

  it(`3: de sidste to stemmer samtidig: begge gemt, ét event, ALL_VOTED (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-3");
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await openPoll(club);
      const [d1] = poll.dateOptionIds as [string];
      const [p1] = poll.placeOptionIds as [string];
      await insertBallot({ pollId: poll.pollId, userId: club.admin.id, optionIds: [d1, p1] });
      const results = await Promise.all(
        [club.mads, club.anders].map((user, i) =>
          staggered(round + i, () =>
            castBallot({
              clubId: club.clubId,
              pollId: poll.pollId,
              userId: user.id,
              now: new Date(),
              choice: { dateOptionIds: [d1], noDateWorks: false, placeOptionId: p1 },
            }),
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(["saved", "saved"]);
      expect(results.filter((r) => r.status === "saved" && r.closed !== null)).toHaveLength(1);
      expect(await db.pollBallot.count({ where: { pollId: poll.pollId } })).toBe(3);
      expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
      expect(await pollState(poll.pollId)).toMatchObject({
        status: "CLOSED",
        closeReason: "ALL_VOTED",
      });
    }
  });

  it(`4: castBallot ‖ lukning ved fristen: stemmen er talt med eller afvist, aldrig ændret efter lukningen (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-4");
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await openPoll(club);
      const [d1, d2] = poll.dateOptionIds as [string, string];
      const [p1] = poll.placeOptionIds as [string];
      await insertBallot({ pollId: poll.pollId, userId: club.admin.id, optionIds: [d1, p1] });
      const deadline = new Date(Date.now() + 2 * MINUTE);
      await db.poll.update({ where: { id: poll.pollId }, data: { deadline } });
      const [vote, close] = await Promise.all([
        staggered(round, () =>
          castBallot({
            clubId: club.clubId,
            pollId: poll.pollId,
            userId: club.mads.id,
            now: new Date(deadline.getTime() - MINUTE),
            choice: { dateOptionIds: [d2], noDateWorks: false, placeOptionId: p1 },
          }),
        ),
        staggered(round + 3, () =>
          closePollIfDue(club.clubId, poll.pollId, new Date(deadline.getTime() + MINUTE)),
        ),
      ]);
      const ballot = await db.pollBallot.findFirst({
        where: { pollId: poll.pollId, userId: club.mads.id },
        select: { updatedAt: true },
      });
      const state = await pollState(poll.pollId);
      expect(state.status).not.toBe("OPEN");
      if (vote.status === "saved") {
        // The vote came first: counted (d1 1 vs d2 1 → a date tie), and the
        // close's write is the later one.
        expect(ballot).not.toBeNull();
        expect(state.updatedAt.getTime()).toBeGreaterThanOrEqual(
          ballot?.updatedAt.getTime() as number,
        );
        expect(close?.status).toBe("AWAITING_DECISION");
      } else {
        expect(vote.status).toBe("closed");
        expect(ballot).toBeNull();
        expect(close?.status).toBe("CLOSED");
      }
    }
  });

  it(`5: leaveClub ‖ castBallot: ingen ikke-medlem har en stemme i en åben afstemning, ingen deadlock (×${LOOPS})`, async () => {
    const admin = await person("Race5 Admin");
    const stays = await person("Race5 Bliver");
    const clubId = await clubWith(admin, [[stays, "MEMBER"]], "R4-race-5");
    const spot = await place(clubId, admin, "Race5 sted");
    const spot2 = await place(clubId, admin, "Race5 sted 2");
    for (let round = 0; round < LOOPS; round += 1) {
      const leaver = await person(`Race5 Går ${round}`);
      await db.membership.create({ data: { clubId, userId: leaver.id, role: "MEMBER" } });
      const poll = await insertPoll({
        clubId,
        createdById: admin.id,
        dates: [inDays(10), inDays(17)],
        placeIds: [spot, spot2],
        deadline: inDays(5),
      });
      const [left, vote] = await Promise.all([
        staggered(round, () => leaveClub({ clubId, userId: leaver.id, now: new Date() })),
        staggered(round + 3, () =>
          castBallot({
            clubId,
            pollId: poll.pollId,
            userId: leaver.id,
            now: new Date(),
            choice: {
              dateOptionIds: [poll.dateOptionIds[0] as string],
              noDateWorks: false,
              placeOptionId: poll.placeOptionIds[0] as string,
            },
          }),
        ),
      ]);
      expect(left.ok).toBe(true);
      expect(["saved", "not-member"]).toContain(vote.status);
      expect((await pollState(poll.pollId)).status).toBe("OPEN");
      expect(await db.pollBallot.count({ where: { pollId: poll.pollId, userId: leaver.id } })).toBe(
        0,
      );
    }
  });

  it(`6: removeMember ‖ closePollIfDue: den lukkede afstemning beholder stemmen kun, hvis lukningen kom først (×${LOOPS})`, async () => {
    const admin = await person("Race6 Admin");
    const clubId = await clubWith(admin, [], "R4-race-6");
    const spot = await place(clubId, admin, "Race6 sted");
    for (let round = 0; round < LOOPS; round += 1) {
      const x = await person(`Race6 X ${round}`);
      await db.membership.create({ data: { clubId, userId: x.id, role: "MEMBER" } });
      const poll = await insertPoll({
        clubId,
        createdById: admin.id,
        dates: [inDays(10), inDays(17)],
        placeIds: [spot],
        deadline: inDays(5),
      });
      await insertBallot({
        pollId: poll.pollId,
        userId: x.id,
        optionIds: [poll.dateOptionIds[0] as string],
      });
      await expirePoll(poll.pollId);
      const [removed, closed] = await Promise.all([
        staggered(round, () =>
          removeMember({ clubId, actorUserId: admin.id, targetUserId: x.id, now: new Date() }),
        ),
        staggered(round + 3, () => closePollIfDue(clubId, poll.pollId, new Date())),
      ]);
      expect(removed.ok).toBe(true);
      const ballots = await db.pollBallot.count({ where: { pollId: poll.pollId, userId: x.id } });
      if (closed?.status === "CLOSED") {
        // The close came first: X's ballot decided the date and stays as history.
        expect(ballots).toBe(1);
      } else {
        // The removal came first: no ballots left → a tie at 0.
        expect(closed?.status).toBe("AWAITING_DECISION");
        expect(ballots).toBe(0);
      }
    }
  });

  it(`7: removePlace ‖ createPoll med samme sted: fjernet + afvist, eller oprettet + in-active-poll (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-7");
    for (let round = 0; round < LOOPS; round += 1) {
      const spot = await place(club.clubId, club.admin, `Race7 sted ${round}`);
      const [removed, created] = await Promise.all([
        staggered(round, () =>
          removePlace({
            clubId: club.clubId,
            placeId: spot,
            actorUserId: club.admin.id,
            actorRole: "ADMIN",
          }),
        ),
        staggered(round + 3, () =>
          settle(
            createPoll({
              clubId: club.clubId,
              createdById: club.mads.id,
              now: new Date(),
              title: `Race7 ${round}`,
              theme: null,
              description: null,
              deadline: inDays(5),
              dateStartsAt: [inDays(10), inDays(17)],
              places: { existingIds: [spot], newPlace: null },
            }),
          ),
        ),
      ]);
      if (removed.status === "deleted") {
        expect(created.ok).toBe(false);
        if (!created.ok) expect(created.error).toBeInstanceOf(PlaceNotSelectableError);
      } else {
        expect(removed.status).toBe("in-active-poll");
        expect(created.ok && created.value.status).toBe("created");
      }
    }
  });

  it(`8 og 9: resolvePollTie ‖ cancelPoll og to resolvePollTie: præcis ét udfald (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-8");
    const tiedPoll = async () => {
      const poll = await openPoll(club);
      await insertBallot({
        pollId: poll.pollId,
        userId: club.admin.id,
        optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
      });
      await insertBallot({
        pollId: poll.pollId,
        userId: club.anders.id,
        optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[1] as string],
      });
      await expirePoll(poll.pollId);
      await closePollIfDue(club.clubId, poll.pollId, new Date());
      return poll;
    };
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await tiedPoll();
      const choices = { PLACE: poll.placeOptionIds[1] as string };
      const [resolved, cancelled] = await Promise.all([
        staggered(round, () =>
          resolvePollTie({
            clubId: club.clubId,
            pollId: poll.pollId,
            actorUserId: club.mads.id,
            now: new Date(),
            choices,
          }),
        ),
        staggered(round + 3, () =>
          cancelPoll({
            clubId: club.clubId,
            pollId: poll.pollId,
            actorUserId: club.admin.id,
            now: new Date(),
          }),
        ),
      ]);
      const state = await pollState(poll.pollId);
      if (resolved.status === "closed") {
        expect(cancelled.status).toBe("already-final");
        expect(state.status).toBe("CLOSED");
        expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
      } else {
        expect(resolved.status).toBe("not-awaiting");
        expect(cancelled.status).toBe("cancelled");
        expect(state.status).toBe("CANCELLED");
        expect(await eventsOfPoll(poll.pollId)).toHaveLength(0);
      }

      const twice = await tiedPoll();
      const results = await Promise.all(
        [club.admin, club.mads].map((actor, i) =>
          staggered(round + i, () =>
            resolvePollTie({
              clubId: club.clubId,
              pollId: twice.pollId,
              actorUserId: actor.id,
              now: new Date(),
              choices: { PLACE: twice.placeOptionIds[i] as string },
            }),
          ),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual(["closed", "not-awaiting"]);
      expect(await eventsOfPoll(twice.pollId)).toHaveLength(1);
      expect(await db.pollTieResolution.count({ where: { pollId: twice.pollId } })).toBe(1);
    }
  });

  it(`10: deleteClub ‖ closePollIfDue: klubben er væk uden RESTRICT-fejl (×${LOOPS})`, async () => {
    for (let round = 0; round < LOOPS; round += 1) {
      const name = `R4-race-10-${round}`;
      const club = await standardClub(name);
      const poll = await openPoll(club);
      await insertBallot({
        pollId: poll.pollId,
        userId: club.admin.id,
        optionIds: [poll.dateOptionIds[0] as string, poll.placeOptionIds[0] as string],
      });
      await expirePoll(poll.pollId);
      const [deleted, closed] = await Promise.all([
        staggered(round, () =>
          settle(
            deleteClub({ clubId: club.clubId, actorUserId: club.admin.id, confirmName: name }),
          ),
        ),
        staggered(round + 3, () => settle(closePollIfDue(club.clubId, poll.pollId, new Date()))),
      ]);
      expect(deleted).toEqual({ ok: true, value: { ok: true } });
      expect(closed.ok).toBe(true);
      expect(await db.club.count({ where: { id: club.clubId } })).toBe(0);
      expect(await db.event.count({ where: { clubId: club.clubId } })).toBe(0);
    }
  });

  it(`11: to castBallot fra samme bruger samtidig (to faner): én stemmeseddel, den sidste vinder (×${LOOPS})`, async () => {
    const club = await standardClub("R4-race-11");
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await openPoll(club);
      const [d1, d2] = poll.dateOptionIds as [string, string];
      const [p1, p2] = poll.placeOptionIds as [string, string];
      const a = { dateOptionIds: [d1], noDateWorks: false, placeOptionId: p1 };
      const b = { dateOptionIds: [d1, d2], noDateWorks: false, placeOptionId: p2 };
      const results = await Promise.all(
        [a, b].map((choice, i) =>
          staggered(round + i * 3, () =>
            castBallot({
              clubId: club.clubId,
              pollId: poll.pollId,
              userId: club.mads.id,
              now: new Date(),
              choice,
            }),
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(["saved", "saved"]);
      const ballots = await db.pollBallot.findMany({
        where: { pollId: poll.pollId, userId: club.mads.id },
        select: { votes: { select: { optionId: true } } },
      });
      expect(ballots).toHaveLength(1);
      const ticks = (ballots[0]?.votes ?? []).map((vote) => vote.optionId).sort();
      expect([[d1, p1].sort(), [d1, d2, p2].sort()]).toContainEqual(ticks);
    }
  });

  it(`12: castBallot ‖ updatePoll med nye valgmuligheder: stemmen eller rettelsen, aldrig begge (×${LOOPS})`, async () => {
    const admin = await person("Race12 Admin");
    const voter = await person("Race12 Stemmer");
    const clubId = await clubWith(admin, [[voter, "MEMBER"]], "R4-race-12");
    const [a, b, c] = [
      await place(clubId, admin, "Race12 A"),
      await place(clubId, admin, "Race12 B"),
      await place(clubId, admin, "Race12 C"),
    ];
    for (let round = 0; round < LOOPS; round += 1) {
      const poll = await insertPoll({
        clubId,
        createdById: admin.id,
        dates: [inDays(10), inDays(17)],
        placeIds: [a as string, b as string],
        deadline: inDays(5),
      });
      const originalIds = [...poll.dateOptionIds, ...poll.placeOptionIds].sort();
      const [vote, update] = await Promise.all([
        staggered(round, () =>
          castBallot({
            clubId,
            pollId: poll.pollId,
            userId: voter.id,
            now: new Date(),
            // Exactly the options the edit removes.
            choice: {
              dateOptionIds: [poll.dateOptionIds[0] as string],
              noDateWorks: false,
              placeOptionId: poll.placeOptionIds[0] as string,
            },
          }),
        ),
        staggered(round + 3, () =>
          updatePoll({
            clubId,
            pollId: poll.pollId,
            actorUserId: admin.id,
            now: new Date(),
            title: "Race12",
            theme: null,
            description: null,
            deadline: inDays(5),
            options: {
              dateStartsAt: [inDays(11), inDays(17)],
              places: { existingIds: [b as string, c as string], newPlace: null },
            },
          }),
        ),
      ]);
      const optionIds = (
        await db.pollOption.findMany({ where: { pollId: poll.pollId }, select: { id: true } })
      )
        .map((row) => row.id)
        .sort();
      const ballots = await db.pollBallot.findMany({
        where: { pollId: poll.pollId },
        select: { votes: { select: { optionId: true } } },
      });
      if (vote.status === "saved") {
        // The vote came first: the options are frozen and the ballot keeps both ticks.
        expect(update).toEqual({ status: "options-locked" });
        expect(optionIds).toEqual(originalIds);
        expect(ballots).toHaveLength(1);
        expect(ballots[0]?.votes).toHaveLength(2);
      } else {
        // The edit came first: the stale form's ids are refused (UNKNOWN_OPTION).
        expect(update).toEqual({ status: "updated" });
        expect(vote).toEqual({
          status: "invalid",
          errors: { dateOptionIds: "UNKNOWN_OPTION", placeOptionId: "UNKNOWN_OPTION" },
        });
        expect(optionIds).not.toEqual(originalIds);
        expect(ballots).toEqual([]);
      }
    }
  });
});
