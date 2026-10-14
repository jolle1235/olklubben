import type { Page, TestInfo } from "@playwright/test";

import { pollDateLongLabel } from "../src/components/features/polls/poll-labels";
import { formatWeekdayDateTime } from "../src/lib/format/date";
import { expect, test } from "./fixtures";
import { clubName, expectHydrated, newUser, signUpWithClub, type TestUser } from "./support/app";
import { insertPlace } from "./support/db";
import { hasHorizontalScroll } from "./support/places";
import {
  expirePoll,
  insertBallot,
  insertPoll,
  latestPollId,
  pollPath,
  pollStatus,
  type InsertedPoll,
} from "./support/polls";
import { at, dayFromToday, isMobile, joinClub } from "./support/round2";

/**
 * Round 4, P1: planning and voting (SPEC §9.7.1–§9.7.3; D-013, D-014,
 * D-133–D-136; E6, E24). The "Planlæg ølsmagning" form with its suggestions,
 * validation and focus, voting and changing the vote ("Skål! Din stemme er
 * gemt ✓"), «Ingen af datoerne passer mig» clearing the dates, a fixed
 * category, the open voters list and "Mangler: …", extending the deadline,
 * and a vote after the deadline. Each test also checks 375 px for sideways
 * scrolling (the mobile project).
 *
 * WRITTEN, NOT RUN in round 4 (Jesper, 2026-10-14: "stop før du starter end
 * to end test", TG-053). Polls for the voting tests are inserted with SQL
 * (e2e/support/polls.ts).
 *
 * PlaceChoiceCard's checkbox tick is ::before content with empty alt text
 * (`content: '✓' / ''`), so a ticked place's name is still exactly its name.
 */

type Club = {
  clubId: string;
  owner: TestUser;
  member: TestUser;
  memberPage: Page;
  hosOwner: string;
  hosMember: string;
};

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
    address: "Søndergade 12",
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

/** An OPEN poll by the owner: two dates (+20/+27 days, 18:30), the given places, deadline +10 days. */
async function openPoll(
  club: Club,
  placeIds = [club.hosOwner, club.hosMember],
  title = "Ølsmagning #15",
): Promise<InsertedPoll> {
  return insertPoll({
    clubId: club.clubId,
    creatorEmail: club.owner.email,
    title,
    dates: [at(dayFromToday(20), "18:30"), at(dayFromToday(27), "18:30")],
    placeIds,
    deadline: at(dayFromToday(10), "20:00"),
  });
}

function placeBox(page: Page, name: string) {
  return page.getByRole("checkbox", { name, exact: true });
}

function dateBox(page: Page, dateKey: string) {
  return page.getByRole("checkbox", {
    name: pollDateLongLabel(at(dateKey, "18:30")),
    exact: true,
  });
}

async function expectNoSideScroll(page: Page, testInfo: TestInfo) {
  if (isMobile(testInfo)) expect(await hasHorizontalScroll(page)).toBe(false);
}

test.describe("Planlæg ølsmagning (§9.7.1)", () => {
  test("opret med forslagene: tre datoer, to steder + ＋ Nyt sted, og fristen følger første dato", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Planlæg");
    await page.goto(`/c/${club.clubId}/polls/new`);
    await expect(page.getByRole("heading", { level: 1, name: "Planlæg ølsmagning" })).toBeVisible();
    await expect(page.getByLabel("Titel")).toHaveValue(/^Ølsmagning #\d+$/);
    const submit = page.getByRole("button", { name: "Opret afstemning" });
    await expectHydrated(submit);

    // Three suggested dates; the deadline is two days before the first at 20:00.
    const dates = page.locator('input[name="dates"]');
    await expect(dates).toHaveCount(3);
    await expect(page.getByLabel("Starttid for alle datoer")).toHaveValue("18:30");
    const deadlineDate = page.locator('input[name="deadlineDate"]');
    const second = await dates.nth(1).inputValue();
    await expect(page.locator('input[name="deadlineTime"]')).toHaveValue("20:00");

    // Removing the first date moves the untouched deadline along.
    const before = await deadlineDate.inputValue();
    await page.getByRole("button", { name: /^Fjern dato 1 / }).click();
    await expect(dates).toHaveCount(2);
    await expect(deadlineDate).not.toHaveValue(before);
    expect(await dates.nth(0).inputValue()).toBe(second);

    // "+ Tilføj dato" adds one week after the last and focuses it.
    await page.getByRole("button", { name: "Tilføj dato" }).click();
    await expect(dates).toHaveCount(3);
    await expect(dates.nth(2)).toBeFocused();

    // Two places + a new one.
    await placeBox(page, "Hos Admin").check();
    await placeBox(page, "Hos Medlem").check();
    await placeBox(page, "＋ Nyt sted").check();
    await page.getByLabel("Navn på stedet").fill("Kælderen");
    await expect(page.getByText(/^Klubben stemmer om 3 datoer og 3 steder · frist /)).toBeVisible();
    await expectNoSideScroll(page, testInfo);

    await submit.click();
    await expect(page.getByText("Afstemningen er klar 🗳 Del linket med klubben.")).toBeVisible();
    const pollId = await latestPollId(club.clubId);
    expect(pollId).not.toBeNull();
    await expect(page).toHaveURL(new RegExp(`${pollPath(club.clubId, pollId ?? "")}`));
    await expect(page.getByRole("heading", { level: 1, name: /^Ølsmagning #\d+$/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Kælderen", exact: true })).toBeVisible();
  });

  test("fejl vises ved felterne, og fokus flytter til det første (D-056)", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Fejl");
    await page.goto(`/c/${club.clubId}/polls/new`);
    const submit = page.getByRole("button", { name: "Opret afstemning" });
    await expectHydrated(submit);

    await page.getByLabel("Titel").fill("");
    await submit.click();
    await expect(page.getByLabel("Titel")).toBeFocused();
    await expect(page.getByText("Giv afstemningen en titel.")).toBeVisible();
    await page.getByLabel("Titel").fill("Juletest");

    // No place ticked.
    await submit.click();
    await expect(page.getByText("Vælg mindst ét sted, eller opret et nyt.")).toBeVisible();

    // One date and one place: nothing to vote on → the event link.
    await placeBox(page, "Hos Admin").check();
    await page.getByRole("button", { name: /^Fjern dato 3/ }).click();
    await page.getByRole("button", { name: /^Fjern dato 2/ }).click();
    await expect(
      page.getByText("Med én dato og ét sted er der ikke noget at stemme om."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "opret et event i stedet" })).toHaveAttribute(
      "href",
      new RegExp(
        `/c/${club.clubId}/events/new\\?date=\\d{4}-\\d\\d-\\d\\d&placeId=${club.hosOwner}$`,
      ),
    );
    await submit.click();
    await expect(page.getByText(/^Tilføj mindst to datoer eller to steder/)).toBeVisible();

    // A deadline after the first date.
    await page.getByRole("button", { name: "Tilføj dato" }).click();
    await page.locator('input[name="deadlineDate"]').fill(dayFromToday(200));
    await submit.click();
    await expect(page.getByText(/^Fristen skal ligge før den første dato/)).toBeVisible();
    await expect(page.locator('input[name="deadlineDate"]')).toBeFocused();
    await expectNoSideScroll(page, testInfo);
  });
});

test.describe("Stem (§9.7.2–§9.7.3)", () => {
  test("stem, ret stemmen, og «Ingen af datoerne passer mig» fjerner datoerne", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Stem");
    const poll = await openPoll(club);
    const { memberPage } = club;

    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    await expect(
      memberPage.getByRole("heading", { level: 1, name: "Ølsmagning #15" }),
    ).toBeVisible();
    await expect(
      memberPage.getByText("Stemmerne er åbne: alle i klubben kan se, hvem der har stemt på hvad."),
    ).toBeVisible();
    const save = memberPage.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(save);

    // Incomplete → both messages, focus on the dates.
    await save.click();
    await expect(
      memberPage.getByText(
        "Sæt kryds ved mindst én dato, eller vælg «Ingen af datoerne passer mig».",
      ),
    ).toBeVisible();
    await expect(memberPage.getByText("Vælg et sted.", { exact: true })).toBeVisible();
    await expect(dateBox(memberPage, dayFromToday(20))).toBeFocused();

    // The optimistic preview: "Ikke gemt endnu" and the counts move.
    await dateBox(memberPage, dayFromToday(20)).check();
    await dateBox(memberPage, dayFromToday(27)).check();
    await memberPage.getByRole("radio", { name: "Hos Medlem", exact: true }).check();
    await expect(memberPage.getByText("Ikke gemt endnu")).toBeVisible();
    await expectNoSideScroll(memberPage, testInfo);
    await save.click();
    await expect(memberPage.getByText("Skål! Din stemme er gemt ✓")).toBeVisible();
    await expect(memberPage.getByText("Du har stemt ✓")).toBeVisible();
    await expect(
      memberPage.getByText(
        `Du kan ændre din stemme indtil ${formatWeekdayDateTime(at(dayFromToday(10), "20:00"))}.`,
      ),
    ).toBeVisible();
    await expect(dateBox(memberPage, dayFromToday(20))).toBeChecked();

    // «Ingen passer» clears the dates (and a date clears it again).
    const none = memberPage.getByRole("checkbox", { name: "Ingen af datoerne passer mig" });
    await none.check();
    await expect(dateBox(memberPage, dayFromToday(20))).not.toBeChecked();
    await expect(dateBox(memberPage, dayFromToday(27))).not.toBeChecked();
    await memberPage.getByRole("button", { name: "Opdatér min stemme" }).click();
    await expect(memberPage.getByText("Skål! Din stemme er gemt ✓")).toBeVisible();
    await expect(none).toBeChecked();
    expect((await pollStatus(poll.pollId)).status).toBe("OPEN");

    // The owner sees who voted for what (D-014) and that they are missing.
    await page.goto(pollPath(club.clubId, poll.pollId));
    await expect(page.getByText(/1 af 2 har stemt/)).toBeVisible();
    await expect(page.getByText("Mangler: dig")).toBeVisible();
    await expect(page.getByText(/1 kan ingen af datoerne: /)).toBeAttached();
  });

  test("et fast sted vises som «ligger fast», og man stemmer kun om datoen", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Fast");
    const poll = await openPoll(club, [club.hosOwner]);
    await page.goto(pollPath(club.clubId, poll.pollId));
    await expect(page.getByText("Hvor:")).toBeVisible();
    await expect(page.getByText("· ligger fast")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    const save = page.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(save);
    await dateBox(page, dayFromToday(27)).check();
    await save.click();
    await expect(page.getByText("Skål! Din stemme er gemt ✓")).toBeVisible();
    await expectNoSideScroll(page, testInfo);
  });

  test("avatarer og navne på stemmerne, og «Mangler: …» for dem uden stemme", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Avatarer");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      email: club.owner.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });
    const { memberPage } = club;
    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    await expect(memberPage.getByText("1 af 2 har stemt")).toBeVisible();
    await expect(memberPage.getByText("Mangler: dig")).toBeVisible();
    await expect(dateBox(memberPage, dayFromToday(20))).toHaveAccessibleDescription(
      new RegExp(`^1 kan: ${club.owner.name.split(" ")[0]}`),
    );
    await expectNoSideScroll(memberPage, testInfo);
  });
});

test.describe("Rediger og fristen (D-133, E6, E24)", () => {
  test("opretteren forlænger fristen; stemmerne bliver stående", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Rediger");
    const poll = await openPoll(club);
    await insertBallot({
      pollId: poll.pollId,
      email: club.member.email,
      optionIds: [poll.dateOptionIds[0]!, poll.placeOptionIds[0]!],
    });
    await page.goto(`${pollPath(club.clubId, poll.pollId)}/edit`);
    await expect(page.getByRole("heading", { level: 1, name: "Rediger afstemning" })).toBeVisible();
    await expect(
      page.getByText(
        "Datoer og steder kan ikke ændres. Er de forkerte, så annullér afstemningen og start en ny.",
      ),
    ).toBeVisible();
    const save = page.getByRole("button", { name: "Gem ændringer" });
    await expectHydrated(save);

    // Shorter is refused.
    await page.locator('input[name="deadlineDate"]').fill(dayFromToday(5));
    await save.click();
    await expect(page.getByText(/^Fristen kan kun rykkes senere \(nu: /)).toBeVisible();

    await page.locator('input[name="deadlineDate"]').fill(dayFromToday(14));
    await save.click();
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    await expect(
      page.getByText(formatWeekdayDateTime(at(dayFromToday(14), "20:00"))),
    ).toBeVisible();
    await expect(page.getByText("1 af 2 har stemt")).toBeVisible();
    await expectNoSideScroll(page, testInfo);

    // An ordinary member gets a 404 on the edit page.
    const response = await club.memberPage.goto(`${pollPath(club.clubId, poll.pollId)}/edit`);
    expect(response?.status()).toBe(404);
  });

  test("en stemme efter fristen afvises: «Afstemningen er lukket 🔒» (E6)", async ({
    page,
    openPage,
  }, testInfo) => {
    const club = await clubWithMember(page, openPage, testInfo, "Frist");
    const poll = await openPoll(club);
    const { memberPage } = club;
    await memberPage.goto(pollPath(club.clubId, poll.pollId));
    const save = memberPage.getByRole("button", { name: "Gem min stemme" });
    await expectHydrated(save);
    await dateBox(memberPage, dayFromToday(20)).check();
    await memberPage.getByRole("radio", { name: "Hos Admin", exact: true }).check();

    await expirePoll(poll.pollId);
    await save.click();
    await expect(memberPage.getByText("Afstemningen er lukket 🔒")).toBeVisible();
    expect((await pollStatus(poll.pollId)).status).not.toBe("OPEN");
    await expect(memberPage.getByRole("button", { name: "Gem min stemme" })).toHaveCount(0);
    await expect(memberPage.getByRole("heading", { name: "Resultatet" })).toBeVisible();
    await expectNoSideScroll(memberPage, testInfo);
    void page;
  });
});
