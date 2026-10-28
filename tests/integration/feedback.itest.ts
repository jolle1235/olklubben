import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import {
  createFeedbackAction,
  deleteFeedbackAction,
  moderateFeedbackAction,
  setFeedbackVoteAction,
  updateFeedbackAction,
} from "@/server/actions/feedback";
import { db } from "@/server/db";
import type { FeedbackViewer } from "@/server/domain/feedback/permissions";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/server/domain/feedback/status";
import { deleteFeedback, setFeedbackVote, updateFeedback } from "@/server/feedback/mutations";
import {
  getFeedbackDetail,
  hasOwnFeedback,
  listDuplicateTargets,
  listFeedback,
  listSimilarCandidates,
} from "@/server/feedback/queries";

import {
  createClub,
  createUser,
  expectNotFound,
  expectRedirect,
  formData,
  setActor,
  type TestUser,
} from "./helpers";

/**
 * Feedback (SPEC §9.9, §15.3, E26–E28, D-141–D-146) against the real
 * database: only the app-admin (APP_ADMIN_EMAILS, mocked below) moderates and
 * sees the technical info, a club admin is NOT an app-admin, 👍 is 1 + votes
 * and never on your own report, the author edits and deletes only while NEW,
 * the duplicate rules, the club id never reaches a stored page, the 10/day
 * limit, 404s, logged-out actors, a deleted author and the CHECKs.
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The integration env disables rate limiting (like E2E); one test turns it on.
// The app-admin list is set to one created user's email in beforeAll.
const envState = vi.hoisted(() => ({ rateLimitDisabled: true, appAdminEmails: [] as string[] }));
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return {
    ...actual,
    get isRateLimitDisabled() {
      return envState.rateLimitDisabled;
    },
    get appAdminEmails() {
      return envState.appAdminEmails;
    },
  };
});

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UNKNOWN_ID = "0199a000-0000-7000-8000-000000000000";
const MALFORMED = "ikke-et-id";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) Itest/1.0";

let author: TestUser;
let stranger: TestUser;
let appAdmin: TestUser;
let clubAdmin: TestUser;
let clubId: string;

const viewerOf = (user: TestUser, isAppAdmin = false): FeedbackViewer => ({
  userId: user.id,
  isAppAdmin,
});

beforeAll(async () => {
  author = await createUser("Forfatter");
  stranger = await createUser("Fremmed");
  appAdmin = await createUser("App-admin");
  clubAdmin = await createUser("Klub-admin");
  // A club ADMIN (role) who is NOT on APP_ADMIN_EMAILS.
  clubId = await createClub(clubAdmin, "Hemmelige Humlehoveder");
  // Upper case and spaces on purpose: isAppAdmin normalises both sides.
  envState.appAdminEmails = [`  ${appAdmin.email.toUpperCase()} `];
  // App-admin also needs a verified email (D-165).
  await db.user.update({ where: { id: appAdmin.id }, data: { emailVerified: true } });
});

beforeEach(() => {
  setActor(null);
  envState.rateLimitDisabled = true;
});

afterEach(() => {
  envState.rateLimitDisabled = true;
});

function bugFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    type: "BUG",
    title: "Kalenderen viser forkert dato",
    description: "Den viser fredag i stedet for lørdag på telefonen.",
    pagePath: "/calendar",
    viewportWidth: "390",
    ...overrides,
  };
}

const featureFields = (overrides: Record<string, string> = {}) =>
  bugFields({
    type: "FEATURE",
    title: "Mørkt tema",
    description: "Et mørkt tema til de sene smagninger.",
    ...overrides,
  });

/** "Send" as `user` (with a browser user agent); returns the new report's id. */
async function create(user: TestUser, fields: Record<string, string> = bugFields()) {
  setActor(user, { "user-agent": USER_AGENT });
  const url = await expectRedirect(
    createFeedbackAction(null, formData(fields)),
    new RegExp(`^/feedback/${UUID}\\?toast=feedback-created$`),
  );
  return url.slice("/feedback/".length, url.indexOf("?"));
}

/** The app-admin's moderation form, as `actor` (null: logged out). */
function moderate(actor: TestUser | null, feedbackId: string, fields: Record<string, string>) {
  setActor(actor);
  return moderateFeedbackAction(
    null,
    formData({ feedbackId, status: "PLANNED", adminResponse: "", duplicateOfId: "", ...fields }),
  );
}

async function moderateOk(feedbackId: string, fields: Record<string, string>) {
  await expectRedirect(
    moderate(appAdmin, feedbackId, fields),
    `/feedback/${feedbackId}?toast=feedback-moderated`,
  );
}

function row(feedbackId: string) {
  return db.feedback.findUnique({ where: { id: feedbackId } });
}

function voteRows(feedbackId: string) {
  return db.feedbackVote.count({ where: { feedbackId } });
}

describe("moderation: only the app-admin (§9.9, §15.3)", () => {
  it("refuses a club admin, the author and a stranger, and leaves the row alone", async () => {
    const id = await create(author);
    const before = await row(id);

    for (const actor of [clubAdmin, author, stranger]) {
      const result = await moderate(actor, id, { status: "DONE", adminResponse: "Rettet" });
      expect(result).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });
    }
    expect(await row(id)).toEqual(before);
  });

  it("refuses an address on APP_ADMIN_EMAILS until the email is verified (D-165)", async () => {
    const id = await create(author);
    await db.user.update({ where: { id: appAdmin.id }, data: { emailVerified: false } });
    try {
      const result = await moderate(appAdmin, id, { status: "DONE" });
      expect(result).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });
      expect((await row(id))?.status).toBe("NEW");
    } finally {
      await db.user.update({ where: { id: appAdmin.id }, data: { emailVerified: true } });
    }
  });

  it("lets the app-admin set every status and an answer", async () => {
    const id = await create(author);
    for (const status of ["PLANNED", "IN_PROGRESS", "DONE", "WONT_DO", "NEW"] as const) {
      await moderateOk(id, { status, adminResponse: `  Svar for ${status}\r\nlinje 2 ` });
      expect(await row(id)).toMatchObject({
        status,
        adminResponse: `Svar for ${status}\nlinje 2`,
        duplicateOfId: null,
      });
    }
    // An empty answer clears it.
    await moderateOk(id, { status: "WONT_DO", adminResponse: "   " });
    expect((await row(id))?.adminResponse).toBeNull();
  });

  it("refuses an unknown status and an overlong answer", async () => {
    const id = await create(author);
    const unknown = await moderate(appAdmin, id, { status: "CLOSED" });
    expect(unknown).toMatchObject({ error: { fieldErrors: { status: ["Vælg en status."] } } });
    const long = await moderate(appAdmin, id, { adminResponse: "x".repeat(2001) });
    expect(long).toMatchObject({
      error: { fieldErrors: { adminResponse: ["Svaret må højst være 2000 tegn."] } },
    });
    expect((await row(id))?.status).toBe("NEW");
  });
});

describe("technical info: only the app-admin sees it (§9.9, D-145)", () => {
  it("is stored for a bug and only returned to the app-admin", async () => {
    const id = await create(author);
    expect(await row(id)).toMatchObject({ userAgent: USER_AGENT, viewportWidth: 390 });

    for (const viewer of [viewerOf(author), viewerOf(stranger), viewerOf(clubAdmin)]) {
      const detail = await getFeedbackDetail(id, viewer);
      expect(detail?.technicalInfo).toBeNull();
      expect(Object.keys(detail ?? {})).not.toContain("userAgent");
      expect(Object.keys(detail ?? {})).not.toContain("viewportWidth");
      expect(JSON.stringify(detail)).not.toContain("Itest/1.0");
    }

    const forAdmin = await getFeedbackDetail(id, viewerOf(appAdmin, true));
    expect(forAdmin?.technicalInfo).toEqual({ userAgent: USER_AGENT, viewportWidth: 390 });
  });

  it("the list never carries it", async () => {
    await create(author);
    const items = await listFeedback(viewerOf(appAdmin, true), {
      type: "all",
      status: "all",
      mine: false,
      sort: "newest",
    });
    expect(JSON.stringify(items)).not.toContain("Itest/1.0");
  });
});

describe("👍 (§9.9, §3.4)", () => {
  it("refuses the author's own report, also straight to the action and the data layer", async () => {
    const id = await create(author);
    setActor(author);
    expect(await setFeedbackVoteAction({ feedbackId: id, voted: true })).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FORBIDDEN,
        message: "Du kan ikke stemme på din egen rapport – den tæller allerede som 1 👍.",
      },
    });
    expect(await setFeedbackVote(viewerOf(author), id, true)).toEqual({ status: "own" });
    expect(await setFeedbackVote(viewerOf(author, true), id, true)).toEqual({ status: "own" });
    expect(await voteRows(id)).toBe(0);
  });

  it("toggles another user's vote, idempotent both ways, counted as 1 + votes", async () => {
    const id = await create(author);
    setActor(stranger);
    expect(await setFeedbackVoteAction({ feedbackId: id, voted: true })).toEqual({
      ok: true,
      data: { voted: true, voteCount: 2 },
    });
    expect(await setFeedbackVoteAction({ feedbackId: id, voted: true })).toEqual({
      ok: true,
      data: { voted: true, voteCount: 2 },
    });
    expect(await voteRows(id)).toBe(1);

    // The app-admin may vote too (not on their own).
    setActor(appAdmin);
    expect(await setFeedbackVoteAction({ feedbackId: id, voted: true })).toMatchObject({
      data: { voteCount: 3 },
    });

    setActor(stranger);
    expect(await setFeedbackVoteAction({ feedbackId: id, voted: false })).toEqual({
      ok: true,
      data: { voted: false, voteCount: 2 },
    });
    expect(await setFeedbackVoteAction({ feedbackId: id, voted: false })).toMatchObject({
      data: { voteCount: 2 },
    });

    const detail = await getFeedbackDetail(id, viewerOf(stranger));
    expect(detail).toMatchObject({ voteCount: 2, viewerHasVoted: false, isOwn: false });
    expect((await getFeedbackDetail(id, viewerOf(appAdmin, true)))?.viewerHasVoted).toBe(true);
  });

  it("is computed, never stored (no count column)", async () => {
    const columns = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback'`;
    const names = columns.map((column) => column.column_name);
    expect(names).toContain("title");
    expect(names.filter((name) => /vote|count|upvote/.test(name))).toEqual([]);
  });

  it("refuses an invalid desired state", async () => {
    const id = await create(author);
    setActor(stranger);
    const result = await setFeedbackVoteAction({
      feedbackId: id,
      voted: "måske" as unknown as boolean,
    });
    expect(result).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.VALIDATION } });
  });
});

describe("edit and delete: the author while NEW, the app-admin always", () => {
  const edit = (actor: TestUser, feedbackId: string, title = "Ny titel her") => {
    setActor(actor);
    return updateFeedbackAction(
      null,
      formData({ feedbackId, title, description: "En ny og længere beskrivelse." }),
    );
  };

  it("lets the author edit and delete while NEW", async () => {
    const id = await create(author);
    await expectRedirect(edit(author, id), `/feedback/${id}?toast=feedback-updated`);
    expect(await row(id)).toMatchObject({
      title: "Ny titel her",
      description: "En ny og længere beskrivelse.",
    });

    setActor(author);
    await expectRedirect(deleteFeedbackAction(id), "/feedback?toast=feedback-deleted");
    expect(await row(id)).toBeNull();
  });

  it("locks the author out once the app-admin has moved it on", async () => {
    const id = await create(author);
    await moderateOk(id, { status: "PLANNED" });

    expect(await edit(author, id)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.FEEDBACK_LOCKED,
        message: "Rapporten er ikke længere ny, så den kan ikke rettes.",
      },
      values: { title: "Ny titel her", description: "En ny og længere beskrivelse." },
    });
    setActor(author);
    expect(await deleteFeedbackAction(id)).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FEEDBACK_LOCKED },
    });
    // The data layer says the same on its own (atomic WHERE status = 'NEW').
    const data = { title: "Snydt titel", description: "Snydt beskrivelse her." };
    expect(await updateFeedback(viewerOf(author), id, data)).toBe("locked");
    expect(await deleteFeedback(viewerOf(author), id)).toBe("locked");
    expect(await row(id)).toMatchObject({ title: "Kalenderen viser forkert dato" });
  });

  it("never lets a stranger (or a club admin) edit or delete", async () => {
    const id = await create(author);
    for (const actor of [stranger, clubAdmin]) {
      expect(await edit(actor, id)).toMatchObject({
        error: { code: ACTION_ERROR_CODES.FORBIDDEN },
      });
      setActor(actor);
      expect(await deleteFeedbackAction(id)).toMatchObject({
        error: { code: ACTION_ERROR_CODES.FORBIDDEN },
      });
    }
    const data = { title: "Snydt titel", description: "Snydt beskrivelse her." };
    expect(await updateFeedback(viewerOf(stranger), id, data)).toBe("forbidden");
    expect(await deleteFeedback(viewerOf(stranger), id)).toBe("forbidden");
    expect(await updateFeedback(viewerOf(stranger), UNKNOWN_ID, data)).toBe("not-found");
    expect(await row(id)).toMatchObject({ title: "Kalenderen viser forkert dato" });
  });

  it("lets the app-admin edit and delete in any status", async () => {
    const id = await create(author);
    await moderateOk(id, { status: "DONE" });
    await expectRedirect(
      edit(appAdmin, id, "Rettet af admin"),
      `/feedback/${id}?toast=feedback-updated`,
    );
    expect((await row(id))?.title).toBe("Rettet af admin");
    setActor(appAdmin);
    await expectRedirect(deleteFeedbackAction(id), "/feedback?toast=feedback-deleted");
    expect(await row(id)).toBeNull();
  });
});

describe("duplicates (E28)", () => {
  it("refuses a missing, self, unknown or duplicate original", async () => {
    const original = await create(author);
    const report = await create(stranger, bugFields({ title: "Forkert dag i kalenderen" }));
    const other = await create(stranger, bugFields({ title: "Samme fejl igen" }));
    await moderateOk(other, { status: "DUPLICATE", duplicateOfId: original });

    const cases: [string, string][] = [
      ["", "Vælg den originale rapport."],
      [report, "En rapport kan ikke være dublet af sig selv."],
      [UNKNOWN_ID, "Den originale rapport findes ikke længere."],
      [MALFORMED, "Vælg den originale rapport."],
      [other, "Vælg den originale rapport, ikke en anden dublet."],
    ];
    for (const [duplicateOfId, message] of cases) {
      const result = await moderate(appAdmin, report, { status: "DUPLICATE", duplicateOfId });
      expect(result, duplicateOfId).toMatchObject({
        ok: false,
        error: { fieldErrors: { duplicateOfId: [message] } },
      });
    }
    expect(await row(report)).toMatchObject({ status: "NEW", duplicateOfId: null });
  });

  it("links the original without moving votes, and leaving DUPLICATE clears the link", async () => {
    const original = await create(author);
    const report = await create(stranger, bugFields({ title: "Forkert dag i kalenderen" }));
    await setFeedbackVote(viewerOf(stranger), original, true);
    await setFeedbackVote(viewerOf(appAdmin, true), original, true);
    await setFeedbackVote(viewerOf(author), report, true);

    await moderateOk(report, {
      status: "DUPLICATE",
      duplicateOfId: original,
      adminResponse: "Se den første rapport.",
    });
    expect(await row(report)).toMatchObject({ status: "DUPLICATE", duplicateOfId: original });
    expect(await voteRows(original)).toBe(2);
    expect(await voteRows(report)).toBe(1);
    const detail = await getFeedbackDetail(report, viewerOf(stranger));
    expect(detail?.duplicateOf).toEqual({ id: original, title: "Kalenderen viser forkert dato" });
    expect(detail?.voteCount).toBe(2);

    // Not offered as an original any more; the report itself never is.
    const targets = (await listDuplicateTargets(original)).map((target) => target.id);
    expect(targets).not.toContain(report);
    expect(targets).not.toContain(original);

    // A duplicateOfId sent with another status is ignored.
    await moderateOk(report, { status: "PLANNED", duplicateOfId: original });
    expect(await row(report)).toMatchObject({ status: "PLANNED", duplicateOfId: null });
  });

  it("deleting the original keeps the duplicate as DUPLICATE without a link", async () => {
    const original = await create(author);
    const report = await create(stranger, bugFields({ title: "Forkert dag i kalenderen" }));
    await moderateOk(report, { status: "DUPLICATE", duplicateOfId: original });

    setActor(appAdmin);
    await expectRedirect(deleteFeedbackAction(original), "/feedback?toast=feedback-deleted");
    expect(await row(report)).toMatchObject({ status: "DUPLICATE", duplicateOfId: null });
    expect((await getFeedbackDetail(report, viewerOf(stranger)))?.duplicateOf).toBeNull();
  });
});

describe("what is stored (E26, §9.9)", () => {
  it("removes the club id, query and hash from a bug's page and stores no club data", async () => {
    const id = await create(
      clubAdmin,
      bugFields({ pagePath: `/c/${clubId}/calendar?x=1#y`, viewportWidth: "1280" }),
    );
    const stored = await row(id);
    expect(stored).toMatchObject({
      type: "BUG",
      pagePath: "/calendar",
      viewportWidth: 1280,
      userAgent: USER_AGENT,
      status: "NEW",
      createdById: clubAdmin.id,
    });
    const text = JSON.stringify(stored);
    expect(text).not.toContain(clubId);
    expect(text).not.toContain("Humlehoveder");
  });

  it("keeps no page, browser or width for a feature", async () => {
    const id = await create(author, featureFields());
    expect(await row(id)).toMatchObject({
      type: "FEATURE",
      pagePath: null,
      userAgent: null,
      viewportWidth: null,
    });
  });

  it("cleans the texts and drops an invalid width", async () => {
    const id = await create(
      author,
      bugFields({
        title: "  Forkert \t dato\u0000  ",
        description: " Linje 1\r\nLinje 2 ",
        viewportWidth: "bred",
      }),
    );
    expect(await row(id)).toMatchObject({
      title: "Forkert dato",
      description: "Linje 1\nLinje 2",
      viewportWidth: null,
    });
  });
});

describe("refused input", () => {
  it("refuses titles, descriptions, types and pages outside the rules, and stores nothing", async () => {
    const before = await db.feedback.count();
    const cases: [Record<string, string>, string, string][] = [
      [bugFields({ title: "ab" }), "title", "Titlen skal være mindst 3 tegn."],
      [bugFields({ title: "x".repeat(121) }), "title", "Titlen må højst være 120 tegn."],
      [bugFields({ title: " ".repeat(50_000) }), "title", "Titlen må højst være 120 tegn."],
      [bugFields({ description: "x".repeat(9) }), "description", "Beskriv det med mindst 10 tegn."],
      [
        bugFields({ description: "x".repeat(5001) }),
        "description",
        "Beskrivelsen må højst være 5000 tegn.",
      ],
      [bugFields({ type: "IDEA" }), "type", "Vælg, om det er en fejl eller en idé."],
      [
        bugFields({ pagePath: "https://evil.example/x" }),
        "pagePath",
        "Skriv en sti, fx /calendar.",
      ],
    ];
    for (const [fields, field, message] of cases) {
      setActor(author);
      const result = await createFeedbackAction(null, formData(fields));
      expect(result, field).toMatchObject({
        ok: false,
        error: { code: ACTION_ERROR_CODES.VALIDATION, fieldErrors: { [field]: [message] } },
      });
    }
    expect(await db.feedback.count()).toBe(before);
  });
});

describe("unknown and malformed ids → 404", () => {
  it("in every action that takes an id", async () => {
    for (const id of [MALFORMED, UNKNOWN_ID]) {
      setActor(appAdmin);
      await expectNotFound(
        updateFeedbackAction(
          null,
          formData({ feedbackId: id, title: "Titel her", description: "Beskrivelse her." }),
        ),
      );
      await expectNotFound(deleteFeedbackAction(id));
      await expectNotFound(setFeedbackVoteAction({ feedbackId: id, voted: true }));
      await expectNotFound(moderate(appAdmin, id, { status: "DONE" }));
    }
    expect(await getFeedbackDetail(MALFORMED, viewerOf(author))).toBeNull();
    expect(await getFeedbackDetail(UNKNOWN_ID, viewerOf(author))).toBeNull();
  });
});

describe("logged out and without a club", () => {
  it("sends a logged-out actor to /login", async () => {
    const id = await create(author);
    setActor(null);
    await expectRedirect(createFeedbackAction(null, formData(bugFields())), /^\/login/);
    await expectRedirect(setFeedbackVoteAction({ feedbackId: id, voted: true }), /^\/login/);
    await expectRedirect(moderate(null, id, { status: "DONE" }), /^\/login/);
    expect(await voteRows(id)).toBe(0);
  });

  it("lets a user without any club report and vote (feedback is app-wide)", async () => {
    const loner = await createUser("Uden klub");
    expect(await db.membership.count({ where: { userId: loner.id } })).toBe(0);
    const own = await create(loner, featureFields({ title: "Klubløs idé" }));
    const other = await create(author);
    setActor(loner);
    expect(await setFeedbackVoteAction({ feedbackId: other, voted: true })).toMatchObject({
      ok: true,
      data: { voteCount: 2 },
    });
    expect((await getFeedbackDetail(own, viewerOf(loner)))?.isOwn).toBe(true);
  });
});

describe("rate limit: 10 reports per user per day (§9.9)", () => {
  it("refuses the 11th report within 24 hours, other users unaffected", async () => {
    envState.rateLimitDisabled = false;
    const busy = await createUser("Travl");
    const calm = await createUser("Rolig");
    for (let n = 1; n <= 10; n += 1) {
      await create(busy, featureFields({ title: `Idé nummer ${n}` }));
    }
    setActor(busy);
    const eleventh = await createFeedbackAction(
      null,
      formData(featureFields({ title: "Idé nummer 11" })),
    );
    expect(eleventh).toMatchObject({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.RATE_LIMITED,
        message: expect.stringMatching(/^Du kan sende højst 10 rapporter i døgnet\. Prøv igen om /),
      },
      values: { title: "Idé nummer 11" },
    });
    expect(await db.feedback.count({ where: { createdById: busy.id } })).toBe(10);

    await create(calm, featureFields({ title: "Rolig idé" }));
    expect(await db.feedback.count({ where: { createdById: calm.id } })).toBe(1);
  });
});

describe("a deleted author (E27)", () => {
  it("keeps the report as 'Tidligere bruger' (still +1) and removes their votes", async () => {
    const leaver = await createUser("Går snart");
    const report = await create(leaver);
    const other = await create(author);
    await setFeedbackVote(viewerOf(leaver), other, true);
    await setFeedbackVote(viewerOf(stranger), report, true);
    expect(await voteRows(other)).toBe(1);

    await db.user.delete({ where: { id: leaver.id } });

    expect((await row(report))?.createdById).toBeNull();
    const detail = await getFeedbackDetail(report, viewerOf(stranger));
    expect(detail).toMatchObject({ authorName: "Tidligere bruger", voteCount: 2, isOwn: false });
    expect(await voteRows(other)).toBe(0);
    // Nobody is its author now: only the app-admin may change it.
    const data = { title: "Ny titel her", description: "Ny beskrivelse her." };
    expect(await updateFeedback(viewerOf(stranger), report, data)).toBe("forbidden");
  });
});

describe("the lists", () => {
  it("filters by type, status group and 'mine', and sorts by votes or newest", async () => {
    const lister = await createUser("Lister");
    const bug = await create(lister, bugFields({ title: "Liste-fejl" }));
    const wish = await create(lister, featureFields({ title: "Liste-ønske" }));
    const closed = await create(lister, featureFields({ title: "Liste-lukket" }));
    await moderateOk(closed, { status: "WONT_DO", adminResponse: "Nej tak." });
    await setFeedbackVote(viewerOf(stranger), wish, true);
    await setFeedbackVote(viewerOf(author), wish, true);

    const mine = { type: "all", status: "open", mine: true, sort: "votes" } as const;
    const viewer = viewerOf(lister);
    expect((await listFeedback(viewer, mine)).map((item) => item.id)).toEqual([wish, bug]);
    expect(
      (await listFeedback(viewer, { ...mine, sort: "newest" })).map((item) => item.id),
    ).toEqual([wish, bug]);
    expect((await listFeedback(viewer, { ...mine, type: "bug" })).map((item) => item.id)).toEqual([
      bug,
    ]);
    expect(
      (await listFeedback(viewer, { ...mine, status: "closed" })).map((item) => item.id),
    ).toEqual([closed]);
    expect(await listFeedback(viewer, { ...mine, status: "all" })).toHaveLength(3);

    const wishItem = (await listFeedback(viewerOf(stranger), { ...mine, mine: false })).find(
      (item) => item.id === wish,
    );
    expect(wishItem).toMatchObject({
      authorName: "Lister",
      voteCount: 3,
      viewerHasVoted: true,
      isOwn: false,
      status: "NEW",
      type: "FEATURE",
    });
    expect(Object.keys(wishItem ?? {}).sort()).toEqual(
      [
        "authorName",
        "createdAt",
        "id",
        "isOwn",
        "status",
        "title",
        "type",
        "viewerHasVoted",
        "voteCount",
      ].sort(),
    );

    const candidates = await listSimilarCandidates();
    expect(candidates.find((candidate) => candidate.id === wish)).toEqual({
      id: wish,
      title: "Liste-ønske",
      status: "NEW",
      voteCount: 3,
    });
  });

  it("tells a user without reports from one whose reports are only under other filters", async () => {
    const newcomer = await createUser("Nykommer");
    expect(await hasOwnFeedback(newcomer.id)).toBe(false);
    const id = await create(newcomer, featureFields({ title: "Nykommerens ønske" }));
    await moderateOk(id, { status: "DONE" });
    // Not on the default "Mine rapporter" (open), but they have sent one.
    const mineOpen = { type: "all", status: "open", mine: true, sort: "votes" } as const;
    expect(await listFeedback(viewerOf(newcomer), mineOpen)).toEqual([]);
    expect(await hasOwnFeedback(newcomer.id)).toBe(true);
  });

  it("closed includes DUPLICATE, open never does", async () => {
    const original = await create(author, bugFields({ title: "Original fejl" }));
    const dup = await create(stranger, bugFields({ title: "Dublet-fejl" }));
    await moderateOk(dup, { status: "DUPLICATE", duplicateOfId: original });
    const base = { type: "all", mine: false, sort: "newest" } as const;
    const open = await listFeedback(viewerOf(author), { ...base, status: "open" });
    const closedItems = await listFeedback(viewerOf(author), { ...base, status: "closed" });
    expect(open.map((item) => item.id)).not.toContain(dup);
    expect(closedItems.map((item) => item.id)).toContain(dup);
  });
});

describe("database CHECKs (D-141)", () => {
  it("refuses technical info on a feature and a report that duplicates itself", async () => {
    await expect(
      db.feedback.create({
        data: {
          type: "FEATURE",
          title: "Direkte indsat",
          description: "Skrevet uden om appen.",
          userAgent: "Mozilla/5.0",
          createdById: author.id,
        },
      }),
    ).rejects.toThrow(/feedback_tech_info_bug_only_check/);

    const id = await create(author);
    await expect(
      db.feedback.update({ where: { id }, data: { status: "DUPLICATE", duplicateOfId: id } }),
    ).rejects.toThrow(/feedback_duplicate_not_self_check/);

    const other = await create(stranger);
    await expect(
      db.feedback.update({ where: { id }, data: { status: "NEW", duplicateOfId: other } }),
    ).rejects.toThrow(/feedback_duplicate_status_check/);

    await expect(db.feedback.update({ where: { id }, data: { title: "  ab  " } })).rejects.toThrow(
      /feedback_title_length_check/,
    );
    await expect(
      db.feedback.update({ where: { id }, data: { pagePath: "calendar" } }),
    ).rejects.toThrow(/feedback_page_path_check/);
    await expect(db.feedback.update({ where: { id }, data: { viewportWidth: 0 } })).rejects.toThrow(
      /feedback_viewport_width_check/,
    );
  });

  it("mirrors the Prisma enums in the domain", () => {
    const statuses: FeedbackStatus[] = [...FEEDBACK_STATUSES];
    expect(statuses).toEqual(["NEW", "PLANNED", "IN_PROGRESS", "DONE", "WONT_DO", "DUPLICATE"]);
  });
});
