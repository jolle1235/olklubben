import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as cronGET } from "@/app/api/cron/close-polls/route";
import { ACTION_ERROR_CODES } from "@/lib/action-result";
import {
  cancelPollAction,
  closePollAction,
  resolvePollTieAction,
} from "@/server/actions/poll-lifecycle";
import { leaveClub } from "@/server/clubs/membership";
import { db } from "@/server/db";
import { getEvent } from "@/server/events/queries";
import { closePollIfDue } from "@/server/polls/close";
import { listOverviewPolls, listPollDateOptions } from "@/server/polls/queries";

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
import {
  DAY,
  eventsOfPoll,
  expirePoll,
  HOUR,
  inDays,
  insertBallot,
  insertPoll,
  pollState,
} from "./poll-helpers";

/**
 * Round 4's lifecycle actions and visibility (SPEC §9.7.4–§9.7.7, §9.1, §9.3,
 * §4.8; D-008, D-131, D-137) against the real database: "Afslut nu",
 * "Annullér" and "Vælg vinder" with their permissions (member → FORBIDDEN,
 * creator and admin ok, a creator who left → 404 while the admins still can,
 * E11), idempotent double submits and toast keys; the cron route handler
 * (503 without a secret, 401, 200 and idempotent); the Overblik cards
 * (listOverviewPolls), the calendar's "Mulig dato" (listPollDateOptions) and
 * getEvent's pollId.
 *
 * These calls are what a forged request would do: hidden buttons are only UX.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** The cron test switches CRON_SECRET off; everything else sees the real env. */
const cronEnv = vi.hoisted(() => ({ unset: false }));
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key, receiver) =>
        key === "CRON_SECRET" && cronEnv.unset ? undefined : Reflect.get(target, key, receiver),
    }),
  };
});

const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";

let admin: TestUser;
let creator: TestUser;
let member: TestUser;
let outsider: TestUser;
let clubId: string;
let hosMads: string;
let hosJesper: string;
let otherClubId: string;
let otherPollId: string;

beforeAll(async () => {
  admin = await createUser("Admin Jesper");
  creator = await createUser("Opretter Mads");
  member = await createUser("Medlem Anders");
  outsider = await createUser("Udenfor Bo");
  clubId = await createClub(admin, "Livscyklus-klubben");
  await addMember(clubId, creator);
  await addMember(clubId, member);
  hosMads = await createPlace(clubId, admin, "Hos Mads", { ownerIds: [creator.id] });
  hosJesper = await createPlace(clubId, admin, "Hos Jesper", { ownerIds: [admin.id] });

  otherClubId = await createClub(outsider, "Fremmed klub");
  const otherPlace = await createPlace(otherClubId, outsider, "Fremmed sted");
  ({ pollId: otherPollId } = await insertPoll({
    clubId: otherClubId,
    createdById: outsider.id,
    dates: [inDays(20), inDays(27)],
    placeIds: [otherPlace],
    deadline: inDays(10),
  }));
});

beforeEach(() => {
  setActor(null);
  cronEnv.unset = false;
});

/** An OPEN poll by `creator` with two dates and two places (deadline in 10 days). */
async function openPoll(title = "Ølsmagning #15", by: TestUser = creator) {
  return insertPoll({
    clubId,
    createdById: by.id,
    title,
    theme: "Juleøl",
    description: "Tag en julebryg med.",
    dates: [inDays(20), inDays(27)],
    placeIds: [hosMads, hosJesper],
    deadline: inDays(10),
  });
}

/** An AWAITING_DECISION poll with a place tie (the date is decided). */
async function tiedPoll(by: TestUser = creator) {
  const poll = await openPoll("Uafgjort smagning", by);
  const [date1] = poll.dateOptionIds;
  const [mads, jesper] = poll.placeOptionIds;
  await insertBallot({ pollId: poll.pollId, userId: creator.id, optionIds: [date1!, mads!] });
  await insertBallot({ pollId: poll.pollId, userId: admin.id, optionIds: [date1!, jesper!] });
  await expirePoll(poll.pollId);
  const outcome = await closePollIfDue(clubId, poll.pollId, new Date());
  expect(outcome).toEqual({ status: "AWAITING_DECISION", tied: ["PLACE"] });
  return poll;
}

const pollPath = (pollId: string, id = clubId) => `/c/${id}/polls/${pollId}`;

describe("closePollAction «Afslut nu» (§9.7.5, D-131)", () => {
  it("afviser et almindeligt medlem med FORBIDDEN og lader afstemningen være", async () => {
    const { pollId } = await openPoll();
    setActor(member);
    const result = await closePollAction(clubId, pollId);
    expect(result).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Kun opretteren og klubbens admins kan afslutte afstemningen.",
      },
    });
    expect((await pollState(pollId)).status).toBe("OPEN");
  });

  it("lader opretteren afslutte med en klar vinder: event + poll-closed, og en gentagelse er harmløs", async () => {
    const poll = await openPoll();
    await insertBallot({
      pollId: poll.pollId,
      userId: member.id,
      optionIds: [poll.dateOptionIds[1]!, poll.placeOptionIds[0]!],
    });
    setActor(creator);
    await expectRedirect(
      closePollAction(clubId, poll.pollId),
      new RegExp(`^${pollPath(poll.pollId)}\\?toast=poll-closed$`),
    );
    const state = await pollState(poll.pollId);
    expect(state).toMatchObject({
      status: "CLOSED",
      closeReason: "MANUAL",
      closedById: creator.id,
    });
    const events = await eventsOfPoll(poll.pollId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Ølsmagning #15",
      theme: "Juleøl",
      placeId: hosMads,
      createdById: creator.id,
      pollId: poll.pollId,
    });
    expect(events[0]!.hosts.map((host) => host.userId)).toEqual([creator.id]);

    // Double submit (second tab, a retry): opens the poll again, no toast, no second event.
    await expectRedirect(
      closePollAction(clubId, poll.pollId),
      new RegExp(`^${pollPath(poll.pollId)}$`),
    );
    expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
  });

  it("lader en admin afslutte en andens afstemning; uafgjort giver poll-awaiting uden event", async () => {
    const { pollId } = await openPoll();
    setActor(admin);
    await expectRedirect(
      closePollAction(clubId, pollId),
      new RegExp(`^${pollPath(pollId)}\\?toast=poll-awaiting$`),
    );
    expect((await pollState(pollId)).status).toBe("AWAITING_DECISION");
    expect(await eventsOfPoll(pollId)).toHaveLength(0);
  });

  it("giver 404 for et ikke-medlem, en anden klubs afstemning og et forkert id", async () => {
    const { pollId } = await openPoll();
    setActor(outsider);
    await expectNotFound(closePollAction(clubId, pollId));
    setActor(admin);
    await expectNotFound(closePollAction(clubId, otherPollId));
    await expectNotFound(closePollAction(clubId, UNKNOWN_ID));
    await expectNotFound(closePollAction(clubId, "ikke-et-id"));
    await expectNotFound(closePollAction("ikke-et-id", pollId));
    expect((await pollState(pollId)).status).toBe("OPEN");
    expect((await pollState(otherPollId)).status).toBe("OPEN");
  });
});

describe("opretteren har forladt klubben (E11)", () => {
  it("giver opretteren 404, mens en admin stadig kan afslutte og annullere", async () => {
    const leaver = await createUser("Forladt Opretter");
    await addMember(clubId, leaver);
    const closing = await openPoll("Forladt 1", leaver);
    const cancelling = await openPoll("Forladt 2", leaver);
    expect((await leaveClub({ clubId, userId: leaver.id, now: new Date() })).ok).toBe(true);

    setActor(leaver);
    await expectNotFound(closePollAction(clubId, closing.pollId));
    await expectNotFound(cancelPollAction(clubId, cancelling.pollId));

    setActor(admin);
    await expectRedirect(
      closePollAction(clubId, closing.pollId),
      new RegExp(`^${pollPath(closing.pollId)}\\?toast=poll-awaiting$`),
    );
    await expectRedirect(
      cancelPollAction(clubId, cancelling.pollId),
      new RegExp(`^${pollPath(cancelling.pollId)}\\?toast=poll-cancelled$`),
    );
  });

  it("lader en admin vælge vinderen, når opretteren er væk", async () => {
    const leaver = await createUser("Forladt Uafgjort");
    await addMember(clubId, leaver);
    const poll = await tiedPoll(leaver);
    expect((await leaveClub({ clubId, userId: leaver.id, now: new Date() })).ok).toBe(true);
    const choice = formData({
      clubId,
      pollId: poll.pollId,
      placeOptionId: poll.placeOptionIds[1]!,
    });

    setActor(leaver);
    await expectNotFound(resolvePollTieAction(null, choice));
    setActor(admin);
    await expectRedirect(
      resolvePollTieAction(null, choice),
      new RegExp(`^${pollPath(poll.pollId)}\\?toast=poll-decided$`),
    );
    const [event] = await eventsOfPoll(poll.pollId);
    // The winning place's owner (the admin) hosts; the creator is gone (E11).
    expect(event).toMatchObject({ placeId: hosJesper, createdById: leaver.id });
    expect(event!.hosts.map((host) => host.userId)).toEqual([admin.id]);
  });
});

describe("cancelPollAction «Annullér» (§9.7.4)", () => {
  it("afviser et medlem, lader opretteren annullere, og en gentagelse er harmløs", async () => {
    const poll = await openPoll();
    await insertBallot({
      pollId: poll.pollId,
      userId: member.id,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });
    setActor(member);
    expect(await cancelPollAction(clubId, poll.pollId)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Kun opretteren og klubbens admins kan annullere afstemningen.",
      },
    });

    setActor(creator);
    await expectRedirect(
      cancelPollAction(clubId, poll.pollId),
      new RegExp(`^${pollPath(poll.pollId)}\\?toast=poll-cancelled$`),
    );
    expect(await pollState(poll.pollId)).toMatchObject({
      status: "CANCELLED",
      cancelledById: creator.id,
      closeReason: null,
    });
    // The votes stay (§9.7.4); no event.
    expect(await db.pollBallot.count({ where: { pollId: poll.pollId } })).toBe(1);
    expect(await eventsOfPoll(poll.pollId)).toHaveLength(0);

    await expectRedirect(
      cancelPollAction(clubId, poll.pollId),
      new RegExp(`^${pollPath(poll.pollId)}$`),
    );
    // A cancelled poll cannot be closed either.
    await expectRedirect(
      closePollAction(clubId, poll.pollId),
      new RegExp(`^${pollPath(poll.pollId)}$`),
    );
    expect((await pollState(poll.pollId)).status).toBe("CANCELLED");
  });

  it("annullerer fra AWAITING_DECISION (admin) og beholder closedAt", async () => {
    const poll = await tiedPoll();
    setActor(admin);
    await expectRedirect(
      cancelPollAction(clubId, poll.pollId),
      new RegExp(`^${pollPath(poll.pollId)}\\?toast=poll-cancelled$`),
    );
    const state = await pollState(poll.pollId);
    expect(state.status).toBe("CANCELLED");
    expect(state.closeReason).toBe("DEADLINE");
    expect(state.closedAt).not.toBeNull();
  });
});

describe("resolvePollTieAction «Vælg vinder» (§9.7.6, D-008)", () => {
  it("afviser et medlem med FORBIDDEN og ekko af valget", async () => {
    const poll = await tiedPoll();
    setActor(member);
    const state = await resolvePollTieAction(
      null,
      formData({ clubId, pollId: poll.pollId, placeOptionId: poll.placeOptionIds[0]! }),
    );
    expect(state).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Kun opretteren og klubbens admins kan vælge vinderen.",
      },
      values: { placeOptionId: poll.placeOptionIds[0] },
    });
    expect((await pollState(poll.pollId)).status).toBe("AWAITING_DECISION");
  });

  it("giver feltfejl for et manglende valg, et ikke-uafgjort sted og et forkert id – uden at skrive", async () => {
    const poll = await tiedPoll();
    setActor(creator);

    const missing = await resolvePollTieAction(null, formData({ clubId, pollId: poll.pollId }));
    expect(missing?.error.code).toBe(ACTION_ERROR_CODES.VALIDATION);
    expect(missing?.error.fieldErrors).toEqual({
      placeOptionId: ["Vælg et af de steder, der står lige."],
    });

    // A date option sent as the place: not one of the tied places.
    const foreign = await resolvePollTieAction(
      null,
      formData({ clubId, pollId: poll.pollId, placeOptionId: poll.dateOptionIds[0]! }),
    );
    expect(foreign?.error.fieldErrors).toEqual({
      placeOptionId: ["Vælg et af de steder, der står lige."],
    });

    // A choice for the date, which is not tied, is refused too (resolveWinner is strict).
    const notTied = await resolvePollTieAction(
      null,
      formData({
        clubId,
        pollId: poll.pollId,
        dateOptionId: poll.dateOptionIds[1]!,
        placeOptionId: poll.placeOptionIds[0]!,
      }),
    );
    expect(notTied?.error.fieldErrors).toEqual({
      dateOptionId: ["Vælg en af de datoer, der står lige."],
    });

    const malformed = await resolvePollTieAction(
      null,
      formData({ clubId, pollId: poll.pollId, placeOptionId: "nope" }),
    );
    expect(malformed?.error.fieldErrors).toEqual({
      placeOptionId: ["Vælg et af de steder, der står lige."],
    });

    expect((await pollState(poll.pollId)).status).toBe("AWAITING_DECISION");
    expect(await db.pollTieResolution.count({ where: { pollId: poll.pollId } })).toBe(0);
    expect(await eventsOfPoll(poll.pollId)).toHaveLength(0);
  });

  it("vælger vinderen, opretter eventet og er idempotent ved dobbelt indsendelse", async () => {
    const poll = await tiedPoll();
    setActor(creator);
    const choice = formData({
      clubId,
      pollId: poll.pollId,
      placeOptionId: poll.placeOptionIds[0]!,
    });
    await expectRedirect(
      resolvePollTieAction(null, choice),
      new RegExp(`^${pollPath(poll.pollId)}\\?toast=poll-decided$`),
    );
    expect(await pollState(poll.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "DEADLINE",
    });
    const resolutions = await db.pollTieResolution.findMany({ where: { pollId: poll.pollId } });
    expect(resolutions).toEqual([
      expect.objectContaining({
        category: "PLACE",
        chosenOptionId: poll.placeOptionIds[0],
        chosenById: creator.id,
      }),
    ]);
    const events = await eventsOfPoll(poll.pollId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ placeId: hosMads, pollId: poll.pollId });

    // getEvent carries the link back to the poll ("Valgt ved afstemning 🗳").
    const detail = await getEvent(clubId, events[0]!.id);
    expect(detail?.pollId).toBe(poll.pollId);

    await expectRedirect(
      resolvePollTieAction(null, choice),
      new RegExp(`^${pollPath(poll.pollId)}$`),
    );
    expect(await eventsOfPoll(poll.pollId)).toHaveLength(1);
  });

  it("giver 404 for et forkert eller fremmed afstemnings-id", async () => {
    setActor(admin);
    await expectNotFound(
      resolvePollTieAction(null, formData({ clubId, pollId: "nope", placeOptionId: "" })),
    );
    await expectNotFound(
      resolvePollTieAction(null, formData({ clubId, pollId: otherPollId, placeOptionId: "" })),
    );
  });

  it("lader et event uden afstemning have pollId null", async () => {
    const event = await db.event.create({
      data: {
        clubId,
        createdById: admin.id,
        placeId: hosJesper,
        title: "Almindeligt event",
        startsAt: inDays(40),
      },
      select: { id: true },
    });
    expect((await getEvent(clubId, event.id))?.pollId).toBeNull();
  });
});

describe("cron-ruten /api/cron/close-polls (§4.8, D-131)", () => {
  const url = "http://localhost/api/cron/close-polls";
  const bearer = () => ({ authorization: `Bearer ${process.env.CRON_SECRET}` });

  it("svarer 503, når CRON_SECRET mangler, og 401 uden eller med forkert token", async () => {
    cronEnv.unset = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const off = await cronGET(new Request(url, { headers: bearer() }));
    expect(off.status).toBe(503);
    expect(await off.json()).toEqual({ error: "CRON_SECRET mangler" });
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    cronEnv.unset = false;

    const none = await cronGET(new Request(url));
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ error: "Ikke autoriseret" });
    for (const authorization of [
      "Bearer forkert-hemmelighed-0123456789",
      `Basic ${process.env.CRON_SECRET}`,
      `${process.env.CRON_SECRET}`,
      "Bearer ",
    ]) {
      const wrong = await cronGET(new Request(url, { headers: { authorization } }));
      expect(wrong.status).toBe(401);
    }
  });

  it("lukker forfaldne afstemninger i to klubber, og et nyt kald lukker intet", async () => {
    const second = await createUser("Cron Anden");
    const secondClub = await createClub(second, "Cron-klub 2");
    const secondPlace = await createPlace(secondClub, second, "Hos Anden", {
      ownerIds: [second.id],
    });
    // Club 1: expired with a clear winner → CLOSED + event.
    const decided = await openPoll("Cron afgjort");
    await insertBallot({
      pollId: decided.pollId,
      userId: member.id,
      optionIds: [decided.dateOptionIds[0]!, decided.placeOptionIds[1]!],
    });
    await expirePoll(decided.pollId);
    // Club 2: every member has voted (ALL_VOTED) before the deadline → CLOSED + event.
    const allVoted = await insertPoll({
      clubId: secondClub,
      createdById: second.id,
      dates: [inDays(15), inDays(22)],
      placeIds: [secondPlace],
      deadline: inDays(5),
    });
    await insertBallot({
      pollId: allVoted.pollId,
      userId: second.id,
      optionIds: [allVoted.dateOptionIds[1]!],
    });
    // Not due: stays OPEN.
    const notDue = await openPoll("Cron ikke forfalden");

    const response = await cronGET(new Request(url, { headers: bearer() }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, number>;
    expect(Object.keys(body).sort()).toEqual(["awaiting", "closed", "clubs", "failed"]);
    expect(body.closed).toBeGreaterThanOrEqual(2);
    expect(body.clubs).toBeGreaterThanOrEqual(2);
    expect(body.failed).toBe(0);

    expect(await pollState(decided.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "DEADLINE",
    });
    expect(await pollState(allVoted.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "ALL_VOTED",
    });
    expect((await pollState(notDue.pollId)).status).toBe("OPEN");
    expect(await eventsOfPoll(decided.pollId)).toHaveLength(1);
    const [secondEvent] = await eventsOfPoll(allVoted.pollId);
    expect(secondEvent).toMatchObject({ clubId: secondClub, placeId: secondPlace });

    // Idempotent: a second run (Vercel retries) closes nothing of ours and creates no event.
    const again = await cronGET(new Request(url, { headers: bearer() }));
    expect(again.status).toBe(200);
    expect(((await again.json()) as Record<string, number>).failed).toBe(0);
    expect(await eventsOfPoll(decided.pollId)).toHaveLength(1);
    expect(await eventsOfPoll(allVoted.pollId)).toHaveLength(1);
    expect((await pollState(notDue.pollId)).status).toBe("OPEN");
  });
});

describe("Overblik: listOverviewPolls (§9.1, D-137)", () => {
  it("viser mangler/stemt/uafgjort/afgjort i den rigtige rækkefølge og skjuler resten", async () => {
    const club = await createClub(admin, "Overblik-klubben");
    await addMember(club, creator);
    const place = await createPlace(club, admin, "Stedet", { ownerIds: [creator.id] });
    const other = await createPlace(club, admin, "Andet sted");
    const now = new Date();
    const poll = (title: string, input: Partial<Parameters<typeof insertPoll>[0]> = {}) =>
      insertPoll({
        clubId: club,
        createdById: creator.id,
        title,
        dates: [inDays(20), inDays(27)],
        placeIds: [place, other],
        deadline: inDays(10),
        ...input,
      });

    // OPEN, the admin has voted (leader: date 2 at "Stedet").
    const voted = await poll("Stemt", { deadline: inDays(3) });
    await insertBallot({
      pollId: voted.pollId,
      userId: admin.id,
      optionIds: [voted.dateOptionIds[1]!, voted.placeOptionIds[0]!],
    });
    // OPEN, the admin is missing (only the creator voted) – a later deadline, still first.
    const missing = await poll("Mangler", { deadline: inDays(8) });
    await insertBallot({
      pollId: missing.pollId,
      userId: creator.id,
      optionIds: [missing.dateOptionIds[0]!, missing.placeOptionIds[0]!],
    });
    // AWAITING_DECISION (0 ballots, E9).
    const tied = await poll("Uafgjort");
    await expirePoll(tied.pollId);
    await closePollIfDue(club, tied.pollId, now);
    // CLOSED today, its event ahead → shown.
    const decided = await poll("Afgjort");
    await insertBallot({
      pollId: decided.pollId,
      userId: admin.id,
      optionIds: [decided.dateOptionIds[0]!, decided.placeOptionIds[0]!],
    });
    await expirePoll(decided.pollId);
    await closePollIfDue(club, decided.pollId, now);
    // CLOSED today, but its event has already ended (a past winning date) → hidden.
    const ended = await poll("Afgjort men overstået", {
      dates: [new Date(now.getTime() - 3 * DAY), new Date(now.getTime() - 2 * DAY)],
    });
    await insertBallot({
      pollId: ended.pollId,
      userId: admin.id,
      optionIds: [ended.dateOptionIds[1]!, ended.placeOptionIds[0]!],
    });
    await expirePoll(ended.pollId);
    await closePollIfDue(club, ended.pollId, now);
    // CLOSED 4 days ago (event still ahead) → hidden.
    const old = await poll("Gammel afgørelse", { deadline: new Date(now.getTime() - 5 * DAY) });
    await insertBallot({
      pollId: old.pollId,
      userId: admin.id,
      optionIds: [old.dateOptionIds[0]!, old.placeOptionIds[0]!],
    });
    await closePollIfDue(club, old.pollId, new Date(now.getTime() - 4 * DAY));
    // CANCELLED → hidden.
    await poll("Annulleret", { status: "CANCELLED" });

    expect((await pollState(decided.pollId)).status).toBe("CLOSED");
    expect((await pollState(ended.pollId)).status).toBe("CLOSED");
    expect((await pollState(old.pollId)).status).toBe("CLOSED");

    const items = await listOverviewPolls(club, admin.id, now);
    expect(items.map((item) => item.title)).toEqual(["Mangler", "Uafgjort", "Stemt", "Afgjort"]);
    const byTitle = Object.fromEntries(items.map((item) => [item.title, item]));

    expect(byTitle.Mangler).toMatchObject({
      status: "OPEN",
      viewerHasVoted: false,
      votedCount: 1,
      memberCount: 2,
      creatorIsMember: true,
      event: null,
    });
    expect(byTitle.Stemt).toMatchObject({ status: "OPEN", viewerHasVoted: true, votedCount: 1 });
    expect(byTitle.Stemt!.leader).toEqual({
      startsAt: (await db.pollOption.findUniqueOrThrow({ where: { id: voted.dateOptionIds[1]! } }))
        .startsAt,
      placeName: "Stedet",
    });
    expect(byTitle.Uafgjort).toMatchObject({
      status: "AWAITING_DECISION",
      tiedCategories: ["DATE", "PLACE"],
      leader: null,
    });
    expect(byTitle.Afgjort).toMatchObject({ status: "CLOSED", leader: null });
    expect(byTitle.Afgjort!.event).toMatchObject({
      placeName: "Stedet",
      hostNames: ["Opretter Mads"],
    });

    // The creator sees the same polls; he has voted in "Mangler", not in "Stemt".
    const forCreator = await listOverviewPolls(club, creator.id, now);
    expect(forCreator.map((item) => item.title)).toEqual([
      "Stemt",
      "Uafgjort",
      "Mangler",
      "Afgjort",
    ]);
    // Another club sees none of them (§4.4).
    expect(await listOverviewPolls(otherClubId, admin.id, now)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Mangler" })]),
    );
  });
});

describe("Kalender: listPollDateOptions (§9.3, D-137)", () => {
  it("viser datoerne fra OPEN og AWAITING med «Du kan ✓», men ikke CLOSED/CANCELLED", async () => {
    const club = await createClub(admin, "Kalender-klubben");
    await addMember(club, creator);
    const place = await createPlace(club, admin, "Kalenderstedet");
    const other = await createPlace(club, admin, "Andet kalendersted");
    const now = new Date();
    const poll = (title: string, input: Partial<Parameters<typeof insertPoll>[0]> = {}) =>
      insertPoll({
        clubId: club,
        createdById: creator.id,
        title,
        dates: [inDays(20), inDays(27)],
        placeIds: [place, other],
        deadline: inDays(10),
        ...input,
      });

    const open = await poll("Åben");
    await insertBallot({
      pollId: open.pollId,
      userId: admin.id,
      optionIds: [open.dateOptionIds[1]!, open.placeOptionIds[0]!],
    });
    const awaiting = await poll("Venter", { dates: [inDays(30), inDays(31)] });
    await expirePoll(awaiting.pollId);
    await closePollIfDue(club, awaiting.pollId, now);
    const closed = await poll("Lukket", { dates: [inDays(33), inDays(34)] });
    await insertBallot({
      pollId: closed.pollId,
      userId: admin.id,
      optionIds: [closed.dateOptionIds[0]!, closed.placeOptionIds[0]!],
    });
    await expirePoll(closed.pollId);
    await closePollIfDue(club, closed.pollId, now);
    await poll("Annulleret", { status: "CANCELLED", dates: [inDays(35), inDays(36)] });

    const options = await listPollDateOptions(club, admin.id, { from: now });
    expect(
      options.map((option) => `${option.pollTitle}:${option.status}:${option.viewerTicked}`),
    ).toEqual([
      "Åben:OPEN:false",
      "Åben:OPEN:true",
      "Venter:AWAITING_DECISION:false",
      "Venter:AWAITING_DECISION:false",
    ]);
    expect(options[0]).toMatchObject({ pollId: open.pollId, optionId: open.dateOptionIds[0] });
    expect(options.every((option) => option.startsAt.getTime() >= now.getTime())).toBe(true);

    // The month grid's half-open range: only the open poll's first date.
    const ranged = await listPollDateOptions(club, admin.id, {
      from: inDays(19),
      to: new Date(inDays(20).getTime() + HOUR),
    });
    expect(ranged.map((option) => option.optionId)).toEqual([open.dateOptionIds[0]]);

    // Another viewer has ticked nothing; another club sees nothing (§4.4).
    expect(
      (await listPollDateOptions(club, creator.id, { from: now })).some((o) => o.viewerTicked),
    ).toBe(false);
    expect(await listPollDateOptions(otherClubId, admin.id, { from: now })).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ pollId: open.pollId })]),
    );
  });
});
