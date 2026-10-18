import { beforeAll, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { NOTHING_TO_VOTE_MESSAGE, POLL_OPTIONS_LOCKED_MESSAGE } from "@/lib/validation/poll";
import { castBallotAction, createPollAction, updatePollAction } from "@/server/actions/polls";
import { db } from "@/server/db";
import { utcToZonedParts } from "@/server/domain/events/time";

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
import { DAY, expirePoll, inDays, insertBallot, insertPoll, pollState } from "./poll-helpers";

/**
 * Round 4, agent P1: the Server Actions for creating, editing and voting on
 * polls (SPEC §9.7.1–§9.7.3, D-133–D-136, E6, E8, E12, E22, E24, F-038)
 * against the real database – what the PollForm, PollEditForm and the vote
 * form can send, and what a forged request can. Run on the agent's own
 * database:
 *
 *   ITEST_DATABASE_URL=postgresql://postgres@localhost:5432/olklubben_r4p1_itest \
 *     npx vitest run --config vitest.integration.config.mts tests/integration/round4-poll-actions.itest.ts
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";

let admin: TestUser;
let mads: TestUser;
let anders: TestUser;
let outsider: TestUser;
let clubId: string;
let otherClubId: string;
let hosMads: string;
let baren: string;
let arkiveret: string;
let naboensSted: string;

/** The Copenhagen calendar day of an instant ("YYYY-MM-DD"). */
const dayOf = (date: Date) => utcToZonedParts(date).date;

/** The create form's fields (the defaults are a valid poll: 2 dates × 2 places). */
function createFields(overrides: Record<string, string | string[]> = {}) {
  return {
    clubId,
    title: "Ølsmagning #30",
    theme: "",
    description: "",
    dates: [dayOf(inDays(20)), dayOf(inDays(27))],
    startTime: "18:30",
    placeIds: [hosMads, baren],
    newPlaceName: "",
    newPlaceAddress: "",
    deadlineDate: dayOf(inDays(15)),
    deadlineTime: "20:00",
    ...overrides,
  };
}

/** A poll in the club: 2 dates (+20/+27 days) × 2 places, deadline +10 days. */
async function openPoll(createdBy: TestUser = admin, deadline = inDays(10)) {
  return insertPoll({
    clubId,
    createdById: createdBy.id,
    title: "Ølsmagning til test",
    dates: [inDays(20), inDays(27)],
    placeIds: [hosMads, baren],
    deadline,
  });
}

function voteFields(pollId: string, overrides: Record<string, string | string[]> = {}) {
  return { clubId, pollId, dateOptionIds: [] as string[], placeOptionId: "", ...overrides };
}

function editFields(pollId: string, overrides: Record<string, string> = {}) {
  return {
    clubId,
    pollId,
    title: "Ølsmagning til test",
    theme: "",
    description: "",
    deadlineDate: dayOf(inDays(12)),
    deadlineTime: "20:00",
    ...overrides,
  };
}

/** The edit form while nobody has voted (D-153): the texts plus the options, like create. */
function editOptionsFields(pollId: string, overrides: Record<string, string | string[]> = {}) {
  return {
    ...editFields(pollId),
    editOptions: "1",
    dates: [dayOf(inDays(20)), dayOf(inDays(34))],
    startTime: "19:00",
    placeIds: [baren],
    newPlace: "on",
    newPlaceName: "Kolonihaven P1",
    newPlaceAddress: "",
    ...overrides,
  };
}

async function optionsOf(pollId: string) {
  const rows = await db.pollOption.findMany({
    where: { pollId },
    select: { id: true, clubId: true, category: true, startsAt: true, placeId: true },
    orderBy: { id: "asc" },
  });
  return rows;
}

const pollUrl = (pollId: string, toast: string) =>
  new RegExp(`^/c/${clubId}/polls/${pollId}\\?toast=${toast}$`);

async function ballotsOf(pollId: string) {
  return db.pollBallot.findMany({
    where: { pollId },
    select: { userId: true, noDateWorks: true, votes: { select: { optionId: true } } },
  });
}

function failure(result: unknown) {
  expect(result).toMatchObject({ ok: false });
  return result as {
    ok: false;
    error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
    values: Record<string, unknown>;
  };
}

beforeAll(async () => {
  admin = await createUser("Admin P1");
  mads = await createUser("Mads P1");
  anders = await createUser("Anders P1");
  outsider = await createUser("Nabo P1");
  clubId = await createClub(admin, "P1-klubben");
  await addMember(clubId, mads);
  await addMember(clubId, anders);
  otherClubId = await createClub(outsider, "Naboklubben P1");

  hosMads = await createPlace(clubId, mads, "Hos Mads", { ownerIds: [mads.id] });
  baren = await createPlace(clubId, admin, "Baren");
  arkiveret = await createPlace(clubId, admin, "Det gamle sted", { archived: true });
  naboensSted = await createPlace(otherClubId, outsider, "Hos Naboen");
});

describe("404s (E22)", () => {
  it("a non-member, another club's poll and malformed ids", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    const vote = voteFields(pollId, {
      dateOptionIds: [dateOptionIds[0] ?? ""],
      placeOptionId: placeOptionIds[0] ?? "",
    });

    setActor(outsider);
    await expectNotFound(castBallotAction(null, formData(vote)));
    await expectNotFound(updatePollAction(null, formData(editFields(pollId))));
    await expectNotFound(createPollAction(null, formData(createFields())));

    const foreign = await insertPoll({
      clubId: otherClubId,
      createdById: outsider.id,
      dates: [inDays(20), inDays(27)],
      placeIds: [naboensSted],
      deadline: inDays(10),
    });
    setActor(admin);
    // The other club's poll id under this club's id.
    await expectNotFound(castBallotAction(null, formData({ ...vote, pollId: foreign.pollId })));
    await expectNotFound(updatePollAction(null, formData(editFields(foreign.pollId))));
    // Malformed and unknown ids.
    await expectNotFound(castBallotAction(null, formData({ ...vote, pollId: "123" })));
    await expectNotFound(castBallotAction(null, formData({ ...vote, pollId: UNKNOWN_ID })));
    await expectNotFound(castBallotAction(null, formData({ ...vote, clubId: "nope" })));
    await expectNotFound(createPollAction(null, formData(createFields({ clubId: "nope" }))));

    expect(await ballotsOf(pollId)).toEqual([]);
    expect(await ballotsOf(foreign.pollId)).toEqual([]);
  });
});

describe("createPollAction", () => {
  it("creates the poll with its options and redirects with poll-created", async () => {
    setActor(mads);
    const url = await expectRedirect(
      createPollAction(
        null,
        formData(createFields({ theme: "Juleøl", description: "Tag en med.\nSkål!" })),
      ),
      new RegExp(`^/c/${clubId}/polls/(${UUID})\\?toast=poll-created$`),
    );
    const pollId = url.split("/").pop()?.split("?")[0] ?? "";
    const poll = await db.poll.findUniqueOrThrow({
      where: { id: pollId },
      select: {
        clubId: true,
        title: true,
        theme: true,
        description: true,
        status: true,
        createdById: true,
        options: { select: { category: true, startsAt: true, placeId: true, clubId: true } },
      },
    });
    expect(poll).toMatchObject({
      clubId,
      title: "Ølsmagning #30",
      theme: "Juleøl",
      description: "Tag en med.\nSkål!",
      status: "OPEN",
      createdById: mads.id,
    });
    expect(poll.options.filter((o) => o.category === "DATE")).toHaveLength(2);
    expect(
      poll.options
        .filter((o) => o.category === "PLACE")
        .map((o) => o.placeId)
        .sort(),
    ).toEqual([hosMads, baren].sort());
    expect(poll.options.every((o) => o.clubId === clubId)).toBe(true);
    // 18:30 Copenhagen on the chosen days.
    for (const option of poll.options.filter((o) => o.category === "DATE")) {
      expect(utcToZonedParts(option.startsAt as Date).time).toBe("18:30");
    }
  });

  it("creates «＋ Nyt sted» in the same transaction (or reuses one by name, E29)", async () => {
    setActor(anders);
    const url = await expectRedirect(
      createPollAction(
        null,
        formData(
          createFields({
            placeIds: [baren],
            newPlace: "on",
            newPlaceName: "  hos mads ",
            newPlaceAddress: "",
          }),
        ),
      ),
      new RegExp(`^/c/${clubId}/polls/(${UUID})\\?toast=poll-created$`),
    );
    const pollId = url.split("/").pop()?.split("?")[0] ?? "";
    const places = await db.pollOption.findMany({
      where: { pollId, category: "PLACE" },
      select: { placeId: true },
    });
    expect(places.map((p) => p.placeId).sort()).toEqual([hosMads, baren].sort());
  });

  it("returns Zod field errors with the values echoed back", async () => {
    setActor(admin);
    const result = failure(
      await createPollAction(
        null,
        formData(createFields({ title: "   ", dates: ["", ""], placeIds: [] })),
      ),
    );
    expect(result.error.code).toBe(ACTION_ERROR_CODES.VALIDATION);
    expect(result.error.fieldErrors).toMatchObject({
      title: ["Giv afstemningen en titel."],
      dates: ["Tilføj mindst én dato."],
    });
    expect(result.values).toMatchObject({ title: "   ", dates: ["", ""], placeIds: [] });

    // With valid dates the place rule runs too (object-level checks wait for their fields, F-037).
    const noPlaces = failure(
      await createPollAction(null, formData(createFields({ placeIds: [] }))),
    );
    expect(noPlaces.error.fieldErrors).toEqual({
      placeIds: ["Vælg mindst ét sted, eller opret et nyt."],
    });
  });

  it("refuses one date and one place (nothing to vote on, D-134)", async () => {
    setActor(admin);
    const result = failure(
      await createPollAction(
        null,
        formData(createFields({ dates: [dayOf(inDays(20))], placeIds: [hosMads] })),
      ),
    );
    expect(result.error.fieldErrors?.dates?.[0]).toMatch(
      /^Tilføj mindst to datoer eller to steder/,
    );
  });

  it("refuses nothing to vote on after the new place turns out to be a chosen one", async () => {
    setActor(admin);
    const result = failure(
      await createPollAction(
        null,
        formData(
          createFields({
            dates: [dayOf(inDays(20))],
            placeIds: [hosMads],
            newPlace: "on",
            newPlaceName: "Hos Mads",
          }),
        ),
      ),
    );
    expect(result.error.fieldErrors?.dates?.[0]).toMatch(
      /^Tilføj mindst to datoer eller to steder/,
    );
  });

  it("maps the server's timing checks to the fields", async () => {
    setActor(admin);
    const past = failure(
      await createPollAction(
        null,
        formData(
          createFields({
            dates: [dayOf(inDays(-3)), dayOf(inDays(20))],
            deadlineDate: dayOf(inDays(-5)),
          }),
        ),
      ),
    );
    expect(past.error.fieldErrors).toEqual({ dates: ["Datoerne skal ligge i fremtiden."] });

    const deadlinePast = failure(
      await createPollAction(null, formData(createFields({ deadlineDate: dayOf(inDays(-1)) }))),
    );
    expect(deadlinePast.error.fieldErrors).toEqual({
      deadlineDate: ["Fristen skal ligge i fremtiden."],
    });

    // The pure schema already refuses a deadline after the first date.
    const late = failure(
      await createPollAction(null, formData(createFields({ deadlineDate: dayOf(inDays(22)) }))),
    );
    expect(late.error.fieldErrors?.deadlineDate?.[0]).toMatch(
      /^Fristen skal ligge før den første dato \(.+ kl\. 18:30\)\.$/,
    );
  });

  it("another club's place, an archived place and an unknown id → placeIds", async () => {
    setActor(admin);
    const foreign = failure(
      await createPollAction(null, formData(createFields({ placeIds: [hosMads, naboensSted] }))),
    );
    expect(foreign.error.fieldErrors).toEqual({
      placeIds: ["Et af stederne findes ikke længere. Vælg igen."],
    });
    const unknown = failure(
      await createPollAction(null, formData(createFields({ placeIds: [hosMads, UNKNOWN_ID] }))),
    );
    expect(unknown.error.fieldErrors?.placeIds).toEqual([
      "Et af stederne findes ikke længere. Vælg igen.",
    ]);
    const archived = failure(
      await createPollAction(null, formData(createFields({ placeIds: [hosMads, arkiveret] }))),
    );
    expect(archived.error.fieldErrors).toEqual({
      placeIds: ["Et af stederne er arkiveret. Vælg et andet."],
    });
    const naboPolls = await db.poll.count({
      where: { title: "Ølsmagning #30", clubId: otherClubId },
    });
    expect(naboPolls).toBe(0);
  });
});

describe("castBallotAction", () => {
  it("saves a ballot → vote-saved, and a change replaces every tick", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    const [d1, d2] = dateOptionIds as [string, string];
    const [p1, p2] = placeOptionIds as [string, string];

    setActor(mads);
    await expectRedirect(
      castBallotAction(
        null,
        formData(voteFields(pollId, { dateOptionIds: [d1, d2], placeOptionId: p1 })),
      ),
      pollUrl(pollId, "vote-saved"),
    );
    expect(await ballotsOf(pollId)).toEqual([
      {
        userId: mads.id,
        noDateWorks: false,
        votes: expect.arrayContaining([{ optionId: d1 }, { optionId: d2 }, { optionId: p1 }]),
      },
    ]);

    await expectRedirect(
      castBallotAction(
        null,
        formData(voteFields(pollId, { noDateWorks: "on", placeOptionId: p2 })),
      ),
      pollUrl(pollId, "vote-saved"),
    );
    expect(await ballotsOf(pollId)).toEqual([
      { userId: mads.id, noDateWorks: true, votes: [{ optionId: p2 }] },
    ]);
  });

  it("invalid input → field errors, nothing written", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    setActor(mads);

    const incomplete = failure(await castBallotAction(null, formData(voteFields(pollId))));
    expect(incomplete.error.fieldErrors).toEqual({
      dateOptionIds: ["Sæt kryds ved mindst én dato, eller vælg «Ingen af datoerne passer mig»."],
      placeOptionId: ["Vælg et sted."],
    });

    const both = failure(
      await castBallotAction(
        null,
        formData(
          voteFields(pollId, {
            dateOptionIds: [dateOptionIds[0] ?? ""],
            noDateWorks: "on",
            placeOptionId: placeOptionIds[0] ?? "",
          }),
        ),
      ),
    );
    expect(both.error.fieldErrors).toEqual({
      dateOptionIds: ["Vælg enten datoer eller «Ingen af datoerne passer mig»."],
    });

    const malformed = failure(
      await castBallotAction(null, formData(voteFields(pollId, { placeOptionId: "nope" }))),
    );
    expect(malformed.error.fieldErrors?.placeOptionId).toEqual(["Vælg et sted fra listen."]);
    expect(await ballotsOf(pollId)).toEqual([]);
  });

  it("a forged option of another poll → a form error, nothing written (F-038)", async () => {
    const { pollId, dateOptionIds } = await openPoll();
    const other = await openPoll();
    setActor(mads);
    const result = failure(
      await castBallotAction(
        null,
        formData(
          voteFields(pollId, {
            dateOptionIds: [dateOptionIds[0] ?? ""],
            placeOptionId: other.placeOptionIds[0] ?? "",
          }),
        ),
      ),
    );
    expect(result.error).toEqual({
      code: ACTION_ERROR_CODES.CONFLICT,
      message: "Afstemningen er ændret. Genindlæs siden.",
    });
    expect(await ballotsOf(pollId)).toEqual([]);
    expect(await ballotsOf(other.pollId)).toEqual([]);
  });

  it("after the deadline → poll-locked, no ballot, and the poll is closed (E6)", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    await insertBallot({
      pollId,
      userId: admin.id,
      optionIds: [dateOptionIds[0] ?? "", placeOptionIds[0] ?? ""],
    });
    await expirePoll(pollId);
    setActor(mads);
    await expectRedirect(
      castBallotAction(
        null,
        formData(
          voteFields(pollId, {
            dateOptionIds: [dateOptionIds[1] ?? ""],
            placeOptionId: placeOptionIds[1] ?? "",
          }),
        ),
      ),
      pollUrl(pollId, "poll-locked"),
    );
    expect((await ballotsOf(pollId)).map((b) => b.userId)).toEqual([admin.id]);
    const state = await pollState(pollId);
    expect(state.status).toBe("CLOSED");
    expect(state.closeReason).toBe("DEADLINE");

    // A second try on the closed poll is locked too.
    await expectRedirect(
      castBallotAction(
        null,
        formData(voteFields(pollId, { noDateWorks: "on", placeOptionId: placeOptionIds[1] ?? "" })),
      ),
      pollUrl(pollId, "poll-locked"),
    );
  });

  it("the last missing ballot closes the poll and creates the event → vote-saved-closed (E8)", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    const [d1, d2] = dateOptionIds as [string, string];
    const [p1] = placeOptionIds as [string, string];
    await insertBallot({ pollId, userId: admin.id, optionIds: [d1, p1] });
    await insertBallot({ pollId, userId: anders.id, optionIds: [d1, d2, p1] });
    setActor(mads);
    await expectRedirect(
      castBallotAction(
        null,
        formData(voteFields(pollId, { dateOptionIds: [d1], placeOptionId: p1 })),
      ),
      pollUrl(pollId, "vote-saved-closed"),
    );
    const state = await pollState(pollId);
    expect(state).toMatchObject({ status: "CLOSED", closeReason: "ALL_VOTED" });
    const events = await db.event.findMany({ where: { pollId }, select: { placeId: true } });
    expect(events).toEqual([{ placeId: hosMads }]);
  });

  it("a member who joined after the poll was created votes and is counted (E12)", async () => {
    const newcomer = await createUser("Nykommer P1");
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    const [d1] = dateOptionIds as [string, string];
    const [p1] = placeOptionIds as [string, string];
    for (const user of [admin, mads, anders]) {
      await insertBallot({ pollId, userId: user.id, optionIds: [d1, p1] });
    }
    // Everyone has voted, but the poll is still OPEN until the next close check.
    await addMember(clubId, newcomer);
    setActor(newcomer);
    await expectRedirect(
      castBallotAction(
        null,
        formData(voteFields(pollId, { dateOptionIds: [d1], placeOptionId: p1 })),
      ),
      pollUrl(pollId, "vote-saved-closed"),
    );
    expect((await ballotsOf(pollId)).map((b) => b.userId)).toContain(newcomer.id);
    await db.membership.deleteMany({ where: { clubId, userId: newcomer.id } });
  });
});

describe("castBallotAction ties", () => {
  it("everyone voted with the place tied → vote-saved-tie, AWAITING_DECISION", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll();
    const [d1] = dateOptionIds as [string, string];
    const [p1, p2] = placeOptionIds as [string, string];
    // A former member's ballot stays in the tally (history, §7.4) but fills no
    // seat: with it the place ends 2–2 once the three current members have voted.
    const former = await createUser("Tidligere P1");
    await addMember(clubId, former);
    await insertBallot({ pollId, userId: former.id, optionIds: [d1, p2] });
    await db.membership.deleteMany({ where: { clubId, userId: former.id } });
    await insertBallot({ pollId, userId: admin.id, optionIds: [d1, p1] });
    await insertBallot({ pollId, userId: anders.id, optionIds: [d1, p2] });
    setActor(mads);
    await expectRedirect(
      castBallotAction(
        null,
        formData(voteFields(pollId, { dateOptionIds: [d1], placeOptionId: p1 })),
      ),
      pollUrl(pollId, "vote-saved-tie"),
    );
    expect(await pollState(pollId)).toMatchObject({
      status: "AWAITING_DECISION",
      closeReason: "ALL_VOTED",
    });
    expect(await db.event.count({ where: { pollId } })).toBe(0);
  });
});

describe("updatePollAction", () => {
  it("a member who is not the creator → FORBIDDEN, nothing changed", async () => {
    const { pollId } = await openPoll(admin);
    setActor(anders);
    const result = failure(
      await updatePollAction(null, formData(editFields(pollId, { title: "Kapret" }))),
    );
    expect(result.error).toEqual({
      code: ACTION_ERROR_CODES.FORBIDDEN,
      message: "Kun opretteren og klubbens admins kan rette afstemningen.",
    });
    expect((await db.poll.findUniqueOrThrow({ where: { id: pollId } })).title).toBe(
      "Ølsmagning til test",
    );
  });

  it("the creator extends the deadline → poll-updated, ballots kept (E24)", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll(mads);
    await insertBallot({
      pollId,
      userId: anders.id,
      optionIds: [dateOptionIds[0] ?? "", placeOptionIds[0] ?? ""],
    });
    setActor(mads);
    await expectRedirect(
      updatePollAction(
        null,
        formData(
          editFields(pollId, {
            title: "Ølsmagning #31",
            theme: "Porter",
            description: "Ny plan",
            deadlineDate: dayOf(inDays(14)),
          }),
        ),
      ),
      pollUrl(pollId, "poll-updated"),
    );
    const poll = await db.poll.findUniqueOrThrow({ where: { id: pollId } });
    expect(poll).toMatchObject({
      title: "Ølsmagning #31",
      theme: "Porter",
      description: "Ny plan",
    });
    expect(dayOf(poll.deadline)).toBe(dayOf(inDays(14)));
    expect(await ballotsOf(pollId)).toHaveLength(1);
  });

  it("an admin may edit another member's poll", async () => {
    const { pollId } = await openPoll(mads);
    setActor(admin);
    await expectRedirect(
      updatePollAction(null, formData(editFields(pollId, { title: "Rettet af admin" }))),
      pollUrl(pollId, "poll-updated"),
    );
  });

  it("shortening the deadline → a field error naming the current one", async () => {
    const { pollId } = await openPoll(admin, inDays(10));
    setActor(admin);
    const result = failure(
      await updatePollAction(
        null,
        formData(editFields(pollId, { deadlineDate: dayOf(inDays(5)) })),
      ),
    );
    expect(result.error.fieldErrors?.deadlineDate?.[0]).toMatch(
      /^Fristen kan kun rykkes senere \(nu: .+ kl\. \d\d:\d\d\)\.$/,
    );
  });

  it("a deadline after the first date → a field error naming the date", async () => {
    const { pollId } = await openPoll(admin);
    setActor(admin);
    const result = failure(
      await updatePollAction(
        null,
        formData(editFields(pollId, { deadlineDate: dayOf(inDays(22)) })),
      ),
    );
    expect(result.error.fieldErrors?.deadlineDate?.[0]).toMatch(
      /^Fristen skal ligge før den første dato \(.+\)\.$/,
    );
  });

  it("invalid fields → Zod errors", async () => {
    const { pollId } = await openPoll(admin);
    setActor(admin);
    const result = failure(
      await updatePollAction(
        null,
        formData(editFields(pollId, { title: "", deadlineTime: "25:99" })),
      ),
    );
    expect(result.error.fieldErrors).toMatchObject({
      title: ["Giv afstemningen en titel."],
      deadlineTime: ["Skriv tiden som tt:mm, fx 20:00."],
    });
  });

  it("a closed poll → poll-locked; an expired one is closed by the edit", async () => {
    const closed = await insertPoll({
      clubId,
      createdById: admin.id,
      dates: [inDays(20), inDays(27)],
      placeIds: [hosMads, baren],
      deadline: inDays(-1),
      status: "CLOSED",
    });
    setActor(admin);
    await expectRedirect(
      updatePollAction(null, formData(editFields(closed.pollId))),
      pollUrl(closed.pollId, "poll-locked"),
    );

    const expired = await openPoll(admin);
    await expirePoll(expired.pollId, DAY);
    await expectRedirect(
      updatePollAction(null, formData(editFields(expired.pollId))),
      pollUrl(expired.pollId, "poll-locked"),
    );
    expect((await pollState(expired.pollId)).status).not.toBe("OPEN");
  });

  it("a creator who has left → 404 (not a member), the admin still may (E11)", async () => {
    const leaver = await createUser("Forlader P1");
    await addMember(clubId, leaver);
    const { pollId } = await openPoll(leaver);
    await db.membership.deleteMany({ where: { clubId, userId: leaver.id } });
    setActor(leaver);
    await expectNotFound(updatePollAction(null, formData(editFields(pollId))));
    setActor(admin);
    await expectRedirect(
      updatePollAction(null, formData(editFields(pollId))),
      pollUrl(pollId, "poll-updated"),
    );
  });
});

describe("updatePollAction with dates and places (D-153)", () => {
  it("nobody has voted: new dates, start time and places → poll-updated", async () => {
    const { pollId } = await openPoll(mads);
    setActor(mads);
    await expectRedirect(
      updatePollAction(null, formData(editOptionsFields(pollId, { title: "Ny plan P1" }))),
      pollUrl(pollId, "poll-updated"),
    );
    const options = await optionsOf(pollId);
    const dates = options.filter((o) => o.category === "DATE");
    expect(dates.map((o) => dayOf(o.startsAt as Date)).sort()).toEqual(
      [dayOf(inDays(20)), dayOf(inDays(34))].sort(),
    );
    for (const option of dates) expect(utcToZonedParts(option.startsAt as Date).time).toBe("19:00");
    const kolonihaven = await db.place.findFirstOrThrow({
      where: { clubId, name: "Kolonihaven P1" },
      select: { id: true, createdById: true },
    });
    expect(kolonihaven.createdById).toBe(mads.id);
    expect(
      options
        .filter((o) => o.category === "PLACE")
        .map((o) => o.placeId)
        .sort(),
    ).toEqual([baren, kolonihaven.id].sort());
    expect(options.every((o) => o.clubId === clubId)).toBe(true);
    expect((await db.poll.findUniqueOrThrow({ where: { id: pollId } })).title).toBe("Ny plan P1");
  });

  it("nobody has voted: the deadline may move earlier; with a vote it may not", async () => {
    const { pollId } = await openPoll(admin, inDays(10));
    setActor(admin);
    await expectRedirect(
      updatePollAction(
        null,
        formData(
          editOptionsFields(pollId, {
            deadlineDate: dayOf(inDays(8)),
            newPlace: "",
            placeIds: [hosMads, baren],
          }),
        ),
      ),
      pollUrl(pollId, "poll-updated"),
    );
    expect(dayOf((await db.poll.findUniqueOrThrow({ where: { id: pollId } })).deadline)).toBe(
      dayOf(inDays(8)),
    );

    const voted = await openPoll(admin, inDays(10));
    await insertBallot({
      pollId: voted.pollId,
      userId: anders.id,
      optionIds: [voted.dateOptionIds[0] ?? "", voted.placeOptionIds[0] ?? ""],
    });
    const shorter = failure(
      await updatePollAction(
        null,
        formData(editFields(voted.pollId, { deadlineDate: dayOf(inDays(8)) })),
      ),
    );
    expect(shorter.error.fieldErrors?.deadlineDate?.[0]).toMatch(/^Fristen kan kun rykkes senere/);
  });

  it("somebody voted in the meantime → CONFLICT, values echoed, nothing changed", async () => {
    const { pollId, dateOptionIds, placeOptionIds } = await openPoll(mads);
    await insertBallot({
      pollId,
      userId: anders.id,
      optionIds: [dateOptionIds[0] ?? "", placeOptionIds[0] ?? ""],
    });
    const before = await optionsOf(pollId);
    const places = await db.place.count({ where: { clubId } });
    setActor(mads);
    const result = failure(
      await updatePollAction(null, formData(editOptionsFields(pollId, { title: "Ikke gemt" }))),
    );
    expect(result.error).toEqual({
      code: ACTION_ERROR_CODES.CONFLICT,
      message: POLL_OPTIONS_LOCKED_MESSAGE,
    });
    expect(result.values).toMatchObject({
      title: "Ikke gemt",
      editOptions: "1",
      dates: [dayOf(inDays(20)), dayOf(inDays(34))],
      placeIds: [baren],
      newPlaceName: "Kolonihaven P1",
    });
    expect(await optionsOf(pollId)).toEqual(before);
    expect(await db.place.count({ where: { clubId } })).toBe(places);
    expect((await db.poll.findUniqueOrThrow({ where: { id: pollId } })).title).toBe(
      "Ølsmagning til test",
    );
  });

  it("maps the data layer's refusals to the fields, nothing changed", async () => {
    const { pollId } = await openPoll(admin);
    const before = await optionsOf(pollId);
    setActor(admin);
    // Every refused edit also ticks "＋ Nyt sted" «Aldrig P1», which must never be created.
    const errorsOf = async (overrides: Record<string, string | string[]>) =>
      failure(
        await updatePollAction(
          null,
          formData(editOptionsFields(pollId, { newPlaceName: "Aldrig P1", ...overrides })),
        ),
      ).error.fieldErrors;

    // "＋ Nyt sted" turns out to be the chosen place: one date and one place left.
    expect(
      await errorsOf({ dates: [dayOf(inDays(20))], placeIds: [hosMads], newPlaceName: "hos MADS" }),
    ).toEqual({ dates: [NOTHING_TO_VOTE_MESSAGE] });
    // The new place is created first and rolled back with the refusal.
    expect(await errorsOf({ placeIds: [hosMads, naboensSted] })).toEqual({
      placeIds: ["Et af stederne findes ikke længere. Vælg igen."],
    });
    expect(await errorsOf({ placeIds: [hosMads, arkiveret] })).toEqual({
      placeIds: ["Et af stederne er arkiveret. Vælg et andet."],
    });
    expect(
      await errorsOf({
        dates: [dayOf(inDays(-3)), dayOf(inDays(20))],
        deadlineDate: dayOf(inDays(-5)),
      }),
    ).toEqual({ dates: ["Datoerne skal ligge i fremtiden."] });
    expect(await errorsOf({ deadlineDate: dayOf(inDays(-1)) })).toEqual({
      deadlineDate: ["Fristen skal ligge i fremtiden."],
    });
    // The schema already names the NEW first date.
    expect((await errorsOf({ deadlineDate: dayOf(inDays(22)) }))?.deadlineDate?.[0]).toMatch(
      /^Fristen skal ligge før den første dato \(.+ kl\. 19:00\)\.$/,
    );
    // editOptions without the option fields (a forged form) → the create form's messages.
    expect(
      await errorsOf({ dates: [], startTime: "", placeIds: [], newPlace: "", newPlaceName: "" }),
    ).toEqual({
      dates: ["Tilføj mindst én dato."],
      startTime: ["Vælg et starttidspunkt."],
    });

    expect(await optionsOf(pollId)).toEqual(before);
    expect(await db.place.count({ where: { clubId, name: "Aldrig P1" } })).toBe(0);
  });

  it("club isolation and permissions: another club's poll → 404, a plain member → FORBIDDEN", async () => {
    const foreign = await insertPoll({
      clubId: otherClubId,
      createdById: outsider.id,
      dates: [inDays(20), inDays(27)],
      placeIds: [naboensSted],
      deadline: inDays(10),
    });
    const foreignBefore = await optionsOf(foreign.pollId);
    setActor(admin);
    await expectNotFound(updatePollAction(null, formData(editOptionsFields(foreign.pollId))));
    setActor(outsider);
    const own = await openPoll(admin);
    await expectNotFound(updatePollAction(null, formData(editOptionsFields(own.pollId))));
    expect(await optionsOf(foreign.pollId)).toEqual(foreignBefore);

    const ownBefore = await optionsOf(own.pollId);
    setActor(anders);
    const forbidden = failure(
      await updatePollAction(null, formData(editOptionsFields(own.pollId))),
    );
    expect(forbidden.error.code).toBe(ACTION_ERROR_CODES.FORBIDDEN);
    expect(await optionsOf(own.pollId)).toEqual(ownBefore);
  });
});
