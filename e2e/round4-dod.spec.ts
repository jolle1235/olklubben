import type { Page, TestInfo } from "@playwright/test";

import { pollDateLongLabel } from "../src/components/features/polls/poll-labels";
import { expect, test } from "./fixtures";
import { clubName, expectHydrated, newUser, signUpWithClub, type TestUser } from "./support/app";
import { insertPlace } from "./support/db";
import { hasHorizontalScroll } from "./support/places";
import {
  eventIdByPollId,
  expirePoll,
  insertBallot,
  insertPoll,
  latestPollId,
  pollPath,
  pollStatus,
} from "./support/polls";
import { at, dayFromToday, isMobile, joinClub } from "./support/round2";

/**
 * Round 4's Definition of Done (SPEC §16.3 "Vi kan planlægge sammen"): an
 * admin plans a tasting, the members vote, the winning date and place become
 * an ordinary event, and it shows on Overblik and in Kalender (§9.7.7). A
 * tie is settled by choosing the winner (D-008), and a vote after the
 * deadline is refused (E6). Two browser contexts: the admin (who created the
 * club) and an ordinary member. Everything that is the point of a test goes
 * through the real UI; SQL only sets up places and the extra polls.
 *
 * Written in round 4 and first run 2026-10-18 (TG-053 resolved): green in
 * the full suite, desktop and 375 px.
 */

type Club = {
  clubId: string;
  admin: TestUser;
  member: TestUser;
  memberPage: Page;
  hosAdmin: string;
  hosMember: string;
};

async function clubWithMember(
  page: Page,
  openPage: () => Promise<Page>,
  testInfo: TestInfo,
  label: string,
): Promise<Club> {
  const admin = newUser(testInfo, `${label}-admin`);
  const member = newUser(testInfo, `${label}-medlem`);
  const clubId = await signUpWithClub(page, admin, clubName(testInfo, label));
  const memberPage = await openPage();
  await joinClub(page, memberPage, member, clubId);
  const hosAdmin = await insertPlace({
    clubId,
    name: "Hos Admin",
    createdByEmail: admin.email,
    ownerEmails: [admin.email],
  });
  const hosMember = await insertPlace({
    clubId,
    name: "Hos Medlem",
    address: "Søndergade 12, 8000 Aarhus C",
    createdByEmail: admin.email,
    ownerEmails: [member.email],
  });
  return { clubId, admin, member, memberPage, hosAdmin, hosMember };
}

/** A date option on the vote form: its accessible name is "lørdag 14. november kl. 18:30". */
function dateBox(page: Page, dateKey: string) {
  return page.getByRole("checkbox", { name: pollDateLongLabel(at(dateKey, "18:30")), exact: true });
}

function placeRadio(page: Page, name: string) {
  return page.getByRole("radio", { name, exact: true });
}

/** The PollCard on Overblik: a region named by its heading "Afstemning: <title>". */
function pollCard(page: Page, title: string) {
  return page.getByRole("region", { name: `Afstemning: ${title}` });
}

async function expectNoSideScroll(page: Page, testInfo: TestInfo) {
  if (isMobile(testInfo)) expect(await hasHorizontalScroll(page)).toBe(false);
}

test.describe("Runde 4: Definition of Done", () => {
  test("(a) admin planlægger, begge stemmer, og vinderen bliver et event på Overblik og i Kalender", async ({
    page,
    openPage,
  }, testInfo) => {
    test.slow(); // Two sign-ups, the poll form and two votes through `next dev`.
    const club = await clubWithMember(page, openPage, testInfo, "Planen");
    const { memberPage } = club;
    const title = "Fælles smagning";

    // Overblik without events: [Planlæg ølsmagning] → the poll form (§9.1, §9.7.1).
    await page.goto(`/c/${club.clubId}`);
    await page.getByRole("link", { name: "Planlæg ølsmagning", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Planlæg ølsmagning" })).toBeVisible();
    const submit = page.getByRole("button", { name: "Opret afstemning" });
    await expectHydrated(submit);
    await page.getByLabel("Titel").fill(title);
    await page.getByLabel(/^Tema/).fill("Juleøl");

    // The three suggested dates stay; both places go to the vote.
    const dates = page.locator('input[name="dates"]');
    await expect(dates).toHaveCount(3);
    const [first, second] = [await dates.nth(0).inputValue(), await dates.nth(1).inputValue()];
    const places = page.getByRole("group", { name: /^Hvor\?/ });
    await places.getByRole("checkbox", { name: "Hos Admin", exact: true }).check();
    await places.getByRole("checkbox", { name: "Hos Medlem", exact: true }).check();
    await expect(page.getByText(/^Klubben stemmer om 3 datoer og 2 steder · frist /)).toBeVisible();
    await expectNoSideScroll(page, testInfo);
    await submit.click();

    await expect(page.getByText("Afstemningen er klar 🗳 Del linket med klubben.")).toBeVisible();
    const pollId = await latestPollId(club.clubId);
    expect(pollId).not.toBeNull();
    await expect(page).toHaveURL(new RegExp(`${pollPath(club.clubId, pollId!)}(\\?|$)`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(
      page.getByText("Stemmerne er åbne: alle i klubben kan se, hvem der har stemt på hvad."),
    ).toBeVisible();

    // The admin votes: the first two dates, the member's place.
    const save = page.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(save);
    await dateBox(page, first).check();
    await dateBox(page, second).check();
    await placeRadio(page, "Hos Medlem").check();
    await save.click();
    await expect(page.getByText("Skål! Din stemme er gemt ✓")).toBeVisible();
    await expect(page.getByText(/1 af 2 har stemt/)).toBeVisible();
    expect((await pollStatus(pollId!)).status).toBe("OPEN");

    // Kalender shows the possible dates dashed, not as events (§9.3).
    await page.goto(`/c/${club.clubId}/calendar?view=list`);
    await expect(
      page.getByRole("link", { name: new RegExp(`${title} \\(afstemning\\)`) }),
    ).toHaveCount(3);

    // The member sees "Du mangler at stemme" on Overblik → [Stem nu] → #stem.
    await memberPage.goto(`/c/${club.clubId}`);
    const card = pollCard(memberPage, title);
    await expect(card.getByText("Du mangler at stemme", { exact: true })).toBeVisible();
    await expectNoSideScroll(memberPage, testInfo);
    await card.getByRole("link", { name: "Stem nu", exact: true }).click();
    await expect(memberPage).toHaveURL(new RegExp(`${pollPath(club.clubId, pollId!)}#stem$`));
    const memberSave = memberPage.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(memberSave);
    await dateBox(memberPage, first).check();
    await placeRadio(memberPage, "Hos Medlem").check();
    await memberSave.click();

    // The last ballot closes the poll in the same transaction (ALL_VOTED, D-131).
    await expect(
      memberPage.getByText("Skål! Din stemme er gemt ✓ Alle har stemt, og eventet er oprettet 🎉"),
    ).toBeVisible();
    const outcome = memberPage.getByRole("region", { name: "🎉 Afstemningen er afsluttet!" });
    await expect(outcome).toContainText("Hos Medlem");
    await expect(outcome).toContainText(`Vært: ${club.member.name}`);
    await expect(outcome).toContainText("Alle havde stemt.");
    expect(await pollStatus(pollId!)).toMatchObject({ status: "CLOSED", closeReason: "ALL_VOTED" });
    const eventId = await eventIdByPollId(pollId!);
    expect(eventId).not.toBeNull();
    await expectNoSideScroll(memberPage, testInfo);

    // An ordinary event: the hero on the admin's Overblik, with the poll's "🎉 Afgjort" card.
    await page.goto(`/c/${club.clubId}`);
    const hero = page.getByRole("region", { name: "Næste ølsmagning" });
    await expect(hero.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(hero).toContainText("Hos Medlem");
    await expect(pollCard(page, title)).toContainText("🎉 Afgjort:");
    await expectNoSideScroll(page, testInfo);

    // Kalender: one confirmed event, the dashed dates are gone.
    await page.goto(`/c/${club.clubId}/calendar?view=list`);
    await expect(
      page.getByRole("link", { name: new RegExp(`${title} \\(afstemning\\)`) }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(`^${title}`) })).toHaveCount(1);
    await page.getByRole("link", { name: new RegExp(`^${title}`) }).click();

    // The event page: date, place, host (the place's owner, D-009) and the poll note.
    await expect(page).toHaveURL(new RegExp(`/c/${club.clubId}/events/${eventId}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(`Vært: ${club.member.name}`)).toBeVisible();
    await expect(page.getByText("Søndergade 12, 8000 Aarhus C")).toBeVisible();
    const note = page.getByRole("link", { name: "Valgt ved afstemning 🗳", exact: true });
    await expect(note).toBeVisible();
    await note.click();
    await expect(page).toHaveURL(new RegExp(`${pollPath(club.clubId, pollId!)}$`));
    await expectNoSideScroll(page, testInfo);
  });

  test("(b) uafgjort om stedet: admin vælger vinderen, og eventet bliver oprettet", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Lige");
    const { memberPage } = club;
    const title = "Lige-smagning";
    const date = dayFromToday(20);
    const poll = await insertPoll({
      clubId: club.clubId,
      creatorEmail: club.admin.email,
      title,
      dates: [at(date, "18:30"), at(dayFromToday(27), "18:30")],
      placeIds: [club.hosAdmin, club.hosMember],
      deadline: at(dayFromToday(10), "20:00"),
    });
    // The admin has voted for their own place with SQL; the member votes for theirs in the UI.
    await insertBallot({
      pollId: poll.pollId,
      email: club.admin.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });
    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    const save = memberPage.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(save);
    await dateBox(memberPage, date).check();
    await placeRadio(memberPage, "Hos Medlem").check();
    await save.click();
    await expect(
      memberPage.getByText("Skål! Din stemme er gemt ✓ Alle har stemt – men der er uafgjort 🤝"),
    ).toBeVisible();
    expect((await pollStatus(poll.pollId)).status).toBe("AWAITING_DECISION");
    // The member waits; the admin decides (D-008, E11).
    await expect(
      memberPage.getByRole("button", { name: "Vælg vinder og opret event" }),
    ).toHaveCount(0);

    await page.goto(`/c/${club.clubId}`);
    const card = pollCard(page, title);
    await expect(card.getByText("Uafgjort 🤝 – du skal vælge vinderen")).toBeVisible();
    await card.getByRole("link", { name: "Vælg vinder", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Der er uafgjort om stedet 🤝" }),
    ).toBeVisible();
    const submit = page.getByRole("button", { name: "Vælg vinder og opret event", exact: true });
    await expectHydrated(submit);
    await page
      .getByRole("group", { name: "Hvilket sted bliver det?" })
      .getByRole("radio", { name: "Hos Admin", exact: true })
      .check();
    await submit.click();

    await expect(page.getByText("🎉 Vinderen er valgt, og eventet er oprettet!")).toBeVisible();
    const outcome = page.getByRole("region", { name: "🎉 Afstemningen er afsluttet!" });
    await expect(outcome).toContainText("Hos Admin");
    await expect(outcome).toContainText(`Vært: ${club.admin.name}`);
    await expect(outcome).toContainText(`${club.admin.name} valgte stedet, da det stod lige.`);
    expect((await pollStatus(poll.pollId)).status).toBe("CLOSED");
    expect(await eventIdByPollId(poll.pollId)).not.toBeNull();
    await expectNoSideScroll(page, testInfo);

    // The member's Overblik has the event in the hero.
    await memberPage.goto(`/c/${club.clubId}`);
    await expect(
      memberPage
        .getByRole("region", { name: "Næste ølsmagning" })
        .getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  });

  test("(c) en stemme efter fristen afvises, og afstemningen lukker (E6)", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Frist");
    const { memberPage } = club;
    const title = "Sen smagning";
    const date = dayFromToday(20);
    const poll = await insertPoll({
      clubId: club.clubId,
      creatorEmail: club.admin.email,
      title,
      dates: [at(date, "18:30"), at(dayFromToday(27), "18:30")],
      placeIds: [club.hosAdmin, club.hosMember],
      deadline: at(dayFromToday(10), "20:00"),
    });
    await insertBallot({
      pollId: poll.pollId,
      email: club.admin.email,
      optionIds: [poll.dateOptionIds[1]!, poll.placeOptionIds[0]!],
    });

    // The member opens the form, and the deadline passes before they save.
    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    const save = memberPage.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(save);
    await dateBox(memberPage, date).check();
    await placeRadio(memberPage, "Hos Medlem").check();
    await expirePoll(poll.pollId);
    await save.click();

    await expect(memberPage.getByText("Afstemningen er lukket 🔒")).toBeVisible();
    expect(await pollStatus(poll.pollId)).toMatchObject({
      status: "CLOSED",
      closeReason: "DEADLINE",
    });
    // Only the admin's ballot counted: their date and place won.
    const outcome = memberPage.getByRole("region", { name: "🎉 Afstemningen er afsluttet!" });
    await expect(outcome).toContainText("Hos Admin");
    await expect(memberPage.getByRole("button", { name: /min stemme$/ })).toHaveCount(0);
    await expectNoSideScroll(memberPage, testInfo);

    await page.goto(`/c/${club.clubId}`);
    await expect(
      page
        .getByRole("region", { name: "Næste ølsmagning" })
        .getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  });
});
