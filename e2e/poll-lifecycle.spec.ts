import type { Page, TestInfo } from "@playwright/test";

import { formatShortDate } from "../src/lib/format/date";
import { expect, test } from "./fixtures";
import { clubName, expectHydrated, newUser, signUpWithClub, type TestUser } from "./support/app";
import { insertPlace } from "./support/db";
import { hasHorizontalScroll, placePath } from "./support/places";
import {
  eventIdByPollId,
  expirePoll,
  insertBallot,
  insertPoll,
  pollPath,
  pollStatus,
  type InsertedPoll,
} from "./support/polls";
import { at, dayFromToday, isMobile, joinClub } from "./support/round2";

/**
 * Round 4, P2: the end of a poll and where it shows (SPEC §9.7.4–§9.7.7,
 * §9.1, §9.2, §9.3; D-008, D-131, D-137). Overblik's "Du mangler at stemme",
 * "Afslut nu" → "🎉 Afstemningen er afsluttet!" → the event with "Valgt ved
 * afstemning 🗳", a tie → "Vælg vinder" → the event, cancel with its
 * confirmation, the lazy close on Overblik, the calendar's dashed "Mulig
 * dato" (gone after the close), E5 on the place page, and a member without
 * the manage buttons. Each test also checks 375 px for sideways scrolling
 * (the mobile project).
 *
 * WRITTEN, NOT RUN in round 4 (Jesper, 2026-10-14: "stop før du starter end
 * to end test", TG-053). Polls are inserted with SQL (e2e/support/polls.ts);
 * the poll form and the vote form are covered by polls.spec.ts.
 */

type Club = {
  clubId: string;
  owner: TestUser;
  /** An ordinary member on their own page (a second browser context). */
  member: TestUser;
  memberPage: Page;
  hosOwner: string;
  hosMember: string;
};

/** The owner's club (owner = ADMIN, on `page`) with one ordinary member and two places. */
async function clubWithMember(
  page: Page,
  openPage: () => Promise<Page>,
  testInfo: TestInfo,
  label: string,
): Promise<Club> {
  const owner = newUser(testInfo, `${label}-admin`);
  const member = newUser(testInfo, `${label}-medlem`);
  const clubId = await signUpWithClub(page, owner, clubName(testInfo, label));
  const memberPage = await openPage();
  await joinClub(page, memberPage, member, clubId);
  const hosOwner = await insertPlace({
    clubId,
    name: "Hos Admin",
    createdByEmail: owner.email,
    ownerEmails: [owner.email],
  });
  const hosMember = await insertPlace({
    clubId,
    name: "Hos Medlem",
    createdByEmail: owner.email,
    ownerEmails: [member.email],
  });
  return { clubId, owner, member, memberPage, hosOwner, hosMember };
}

/** An OPEN poll by the owner: two dates (+20/+27 days, 18:30), both places, deadline +10 days. */
async function openPoll(club: Club, title = "Ølsmagning #15"): Promise<InsertedPoll> {
  return insertPoll({
    clubId: club.clubId,
    creatorEmail: club.owner.email,
    title,
    dates: [at(dayFromToday(20), "18:30"), at(dayFromToday(27), "18:30")],
    placeIds: [club.hosOwner, club.hosMember],
    deadline: at(dayFromToday(10), "20:00"),
  });
}

/** The PollCard on Overblik (a region named by its heading "Afstemning: <title>"). */
function pollCard(page: Page, title: string) {
  return page.getByRole("region", { name: `Afstemning: ${title}` });
}

async function expectNoSideScroll(page: Page, testInfo: TestInfo) {
  if (isMobile(testInfo)) expect(await hasHorizontalScroll(page)).toBe(false);
}

test.describe("Afstemningens afslutning (§9.7.4–§9.7.7)", () => {
  test("Overblik: «Du mangler at stemme» og [Stem nu] fører til stemmesedlen", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Mangler");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      email: club.owner.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });

    const { memberPage } = club;
    await memberPage.goto(`/c/${club.clubId}`);
    const card = pollCard(memberPage, "Ølsmagning #15");
    await expect(card).toBeVisible();
    await expect(card.getByText("Du mangler at stemme", { exact: true })).toBeVisible();
    await expect(card).toContainText("1 af 2 har stemt");
    await expectNoSideScroll(memberPage, testInfo);
    await card.getByRole("link", { name: "Stem nu", exact: true }).click();
    await expect(memberPage).toHaveURL(new RegExp(`${pollPath(club.clubId, poll.pollId)}#stem$`));

    // The owner has voted: "Du har stemt ✓" and the current leader.
    await page.goto(`/c/${club.clubId}`);
    const ownerCard = pollCard(page, "Ølsmagning #15");
    await expect(ownerCard.getByText("Du har stemt ✓", { exact: true })).toBeVisible();
    await expect(ownerCard).toContainText("Fører lige nu:");
    await expect(
      ownerCard.getByRole("link", { name: "Se afstemningen", exact: true }),
    ).toBeVisible();
  });

  test("«Afslut nu» → «🎉 Afstemningen er afsluttet!» → eventet med «Valgt ved afstemning 🗳»", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Afslut");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      email: club.member.email,
      optionIds: [poll.dateOptionIds[1]!, poll.placeOptionIds[1]!],
    });

    await page.goto(pollPath(club.clubId, poll.pollId));
    const close = page.getByRole("button", { name: "Afslut afstemning nu", exact: true });
    await expectHydrated(close);
    await close.click();
    const dialog = page.getByRole("alertdialog", { name: "Afslut afstemningen nu?" });
    await expect(dialog).toContainText("1 af 2 har stemt.");
    await dialog.getByRole("button", { name: "Afslut nu", exact: true }).click();

    await expect(
      page.getByText("🎉 Afstemningen er afsluttet, og eventet er oprettet!"),
    ).toBeVisible();
    const outcome = page.getByRole("region", { name: "🎉 Afstemningen er afsluttet!" });
    await expect(outcome).toContainText("Hos Medlem");
    await expect(outcome).toContainText(`Vært: ${club.member.name}`);
    await expect(outcome).toContainText(`Afsluttet af ${club.owner.name}.`);
    await expectNoSideScroll(page, testInfo);
    expect((await pollStatus(poll.pollId)).status).toBe("CLOSED");
    // The manage buttons are gone once the poll is decided.
    await expect(page.getByRole("button", { name: "Annullér afstemning" })).toHaveCount(0);

    const eventId = await eventIdByPollId(poll.pollId);
    expect(eventId).not.toBeNull();
    await outcome.getByRole("link", { name: "Se event", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${club.clubId}/events/${eventId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Ølsmagning #15" })).toBeVisible();
    const note = page.getByRole("link", { name: "Valgt ved afstemning 🗳", exact: true });
    await expect(note).toBeVisible();
    await note.click();
    await expect(page).toHaveURL(new RegExp(`${pollPath(club.clubId, poll.pollId)}$`));
  });

  test("uafgjort: Overblik [Vælg vinder] → valget opretter eventet; medlemmet venter", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Uafgjort");
    const poll = await openPoll(club, "Uafgjort smagning");
    const [date1] = poll.dateOptionIds;
    const [owner, member] = poll.placeOptionIds;
    await insertBallot({
      pollId: poll.pollId,
      email: club.owner.email,
      optionIds: [date1!, owner!],
    });
    await insertBallot({
      pollId: poll.pollId,
      email: club.member.email,
      optionIds: [date1!, member!],
    });
    // Both have voted: the next view closes it (ALL_VOTED) into a place tie.

    const { memberPage } = club;
    await memberPage.goto(`/c/${club.clubId}`);
    const waiting = pollCard(memberPage, "Uafgjort smagning");
    await expect(waiting).toContainText(`Uafgjort 🤝 – ${club.owner.name} eller en admin vælger`);
    await expect(waiting.getByRole("link", { name: "Vælg vinder" })).toHaveCount(0);
    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    await expect(
      memberPage.getByRole("heading", { level: 2, name: "Der er uafgjort om stedet 🤝" }),
    ).toBeVisible();
    await expect(
      memberPage.getByText(`${club.owner.name} eller en admin vælger vinderen.`),
    ).toBeVisible();
    await expect(
      memberPage.getByRole("button", { name: "Vælg vinder og opret event" }),
    ).toHaveCount(0);

    await page.goto(`/c/${club.clubId}`);
    const card = pollCard(page, "Uafgjort smagning");
    await expect(card.getByText("Uafgjort 🤝 – du skal vælge vinderen")).toBeVisible();
    await card.getByRole("link", { name: "Vælg vinder", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${pollPath(club.clubId, poll.pollId)}$`));

    // The browser asks for a choice first (no write).
    const submit = page.getByRole("button", { name: "Vælg vinder og opret event", exact: true });
    await expectHydrated(submit);
    await submit.click();
    await expect(page.getByText("Vælg et af de steder, der står lige.")).toBeVisible();
    expect((await pollStatus(poll.pollId)).status).toBe("AWAITING_DECISION");

    await page
      .getByRole("group", { name: "Hvilket sted bliver det?" })
      .getByRole("radio", { name: "Hos Medlem", exact: true })
      .check();
    await submit.click();
    await expect(page.getByText("🎉 Vinderen er valgt, og eventet er oprettet!")).toBeVisible();
    const outcome = page.getByRole("region", { name: "🎉 Afstemningen er afsluttet!" });
    await expect(outcome).toContainText(`${club.owner.name} valgte stedet, da det stod lige.`);
    await expect(outcome).toContainText("Hos Medlem");
    await expectNoSideScroll(page, testInfo);
    expect(await eventIdByPollId(poll.pollId)).not.toBeNull();
  });

  test("annullér med bekræftelse: intet event, banneret og stemmerne bliver stående", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Annuller");
    const poll = await openPoll(club, "Aflyst smagning");
    await insertBallot({
      pollId: poll.pollId,
      email: club.member.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });

    await page.goto(pollPath(club.clubId, poll.pollId));
    const cancel = page.getByRole("button", { name: "Annullér afstemning", exact: true });
    await expectHydrated(cancel);
    await cancel.click();
    const dialog = page.getByRole("alertdialog", { name: "Annullér «Aflyst smagning»?" });
    await expect(dialog).toContainText("Der bliver ikke oprettet et event.");
    // "Behold den" keeps it open.
    await dialog.getByRole("button", { name: "Behold den", exact: true }).click();
    expect((await pollStatus(poll.pollId)).status).toBe("OPEN");

    await cancel.click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Annullér afstemning", exact: true })
      .click();
    await expect(page.getByText("Afstemningen er annulleret.", { exact: true })).toBeVisible();
    const banner = page.getByRole("region", { name: "Afstemningen er annulleret" });
    await expect(banner).toContainText(`Annulleret af ${club.owner.name}`);
    await expect(banner).toContainText("Der blev ikke oprettet et event.");
    await expectNoSideScroll(page, testInfo);
    expect((await pollStatus(poll.pollId)).status).toBe("CANCELLED");
    expect(await eventIdByPollId(poll.pollId)).toBeNull();

    // Gone from Overblik.
    await page.goto(`/c/${club.clubId}`);
    await expect(pollCard(page, "Aflyst smagning")).toHaveCount(0);
  });

  test("et almindeligt medlem ser ingen styreknapper, kun hvem der kan", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Medlem");
    const poll = await openPoll(club);
    const { memberPage } = club;
    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    await expect(
      memberPage.getByText(
        `${club.owner.name} (opretteren) og klubbens admins kan afslutte eller annullere afstemningen.`,
      ),
    ).toBeVisible();
    for (const name of ["Rediger", "Afslut afstemning nu", "Annullér afstemning"]) {
      await expect(memberPage.getByRole("button", { name, exact: true })).toHaveCount(0);
      await expect(memberPage.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
    await expectNoSideScroll(memberPage, testInfo);
  });
});

test.describe("Synlighed: Overblik og Kalender (§9.1, §9.3, D-131, D-137)", () => {
  test("Overblik lukker en udløbet afstemning dovent og viser eventet i hero-kortet", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Doven");
    const poll = await openPoll(club, "Doven smagning");
    await insertBallot({
      pollId: poll.pollId,
      email: club.member.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[1]!],
    });
    await expirePoll(poll.pollId);

    await page.goto(`/c/${club.clubId}`);
    const hero = page.getByRole("region", { name: "Næste ølsmagning" });
    await expect(hero.getByRole("heading", { level: 2, name: "Doven smagning" })).toBeVisible();
    await expect(pollCard(page, "Doven smagning")).toContainText("🎉 Afgjort:");
    expect(await pollStatus(poll.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "DEADLINE",
    });
    await expectNoSideScroll(page, testInfo);
  });

  test("Kalender viser «Mulig dato» stiplet i listen og måneden, og den forsvinder efter lukningen", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Kalender");
    const poll = await openPoll(club, "Kalender-afstemning");
    const deadline = at(dayFromToday(10), "20:00");
    await insertBallot({
      pollId: poll.pollId,
      email: club.owner.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });

    await page.goto(`/c/${club.clubId}/calendar?view=list`);
    const possible = page.getByRole("link", { name: /Kalender-afstemning \(afstemning\)/ });
    await expect(possible).toHaveCount(2);
    await expect(possible.first()).toContainText(
      `Mulig dato · stem inden ${formatShortDate(deadline)}`,
    );
    await expect(possible.first()).toContainText("Du kan ✓");
    await expect(possible.nth(1)).not.toContainText("Du kan ✓");
    await expectNoSideScroll(page, testInfo);

    const month = dayFromToday(20).slice(0, 7);
    await page.goto(`/c/${club.clubId}/calendar?view=month&month=${month}`);
    if (isMobile(testInfo)) {
      // Mobile: the day's button names the possible date; the day panel lists it.
      const day = dayFromToday(20);
      await page
        .getByRole("link", { name: /1 mulig dato/ })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`day=${day}`));
      await expect(
        page.getByRole("link", { name: /Kalender-afstemning \(afstemning\)/ }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("link", {
          name: /^Mulig dato: Kalender-afstemning, .* afstemning, stem inden /,
        }),
      ).not.toHaveCount(0);
    }

    // Closing removes the dashed dates; the event shows as an ordinary one.
    await expirePoll(poll.pollId);
    await page.goto(`/c/${club.clubId}/calendar?view=list`);
    await expect(
      page.getByRole("link", { name: /Kalender-afstemning \(afstemning\)/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Kalender-afstemning/ })).toHaveCount(1);
  });

  test("E5: et sted i en åben afstemning kan ikke fjernes, og stedets side linker til afstemningen", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Sted");
    const poll = await openPoll(club, "Steds-afstemning");
    await page.goto(placePath(club.clubId, club.hosMember));
    await expect(
      page.getByText(
        "Stedet er med i afstemningen «Steds-afstemning», så det kan ikke arkiveres, før den er afsluttet eller annulleret.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Arkivér|Slet) sted/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Se afstemningen", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${pollPath(club.clubId, poll.pollId)}$`));
    await expectNoSideScroll(page, testInfo);
  });
});
