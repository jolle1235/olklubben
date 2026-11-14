import { expect } from "@playwright/test";

import { createReport, openApp, type App, type Login } from "./driver";
import { BEERS, CLUBS, EVENTS, POLLS, SEED_PASSWORD, SONGS, USERS } from "./fixtures";

const DRENGENE = `/c/${CLUBS.drengene.id}`;
const TORSDAG = `/c/${CLUBS.torsdag.id}`;

type Journey = {
  /** "<feature file>: <what it proves>", printed on the PASS/FAIL line. */
  name: string;
  as: Login;
  drive: (app: App) => Promise<string | void>;
};

/**
 * One read-only journey per file in .claude/flow/features/. Who drives what
 * keeps reruns identical: Anders has one club, so his login always lands on the
 * same Overblik; the songbook (Torsdagsklubben) is opened as Mads, so
 * Kaptajnen's last active club stays Drengene & Bajere.
 */
const JOURNEYS: Journey[] = [
  {
    name: "login: Anders logger ind og lander på Overblik",
    as: null,
    drive: async (app) => {
      const { page } = app;
      await app.goto("/");
      await expect(page).toHaveURL(/\/login$/);
      await page.getByLabel("Email").fill(USERS.anders.email);
      await page.getByLabel("Password", { exact: true }).fill(SEED_PASSWORD);
      await page.getByRole("button", { name: "Log ind", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${DRENGENE}$`));
      await expect(page.getByRole("heading", { level: 1, name: "Overblik" })).toBeAttached();
      await app.shot("smoke-login");
      return page.url();
    },
  },
  {
    name: "overview: næste ølsmagning og afstemningen, Kaptajnen mangler",
    as: "jesper",
    drive: async (app) => {
      const { page } = app;
      await app.goto(DRENGENE);
      const next = page.getByRole("region", { name: "Næste ølsmagning" });
      await expect(next.getByRole("heading", { name: EVENTS.next13.title })).toBeVisible();
      const poll = page.getByRole("region", { name: `Afstemning: ${POLLS.open.title}` });
      await expect(poll.getByText("Du mangler at stemme")).toBeVisible();
      await expect(page.getByRole("region", { name: "Tidligere ølsmagninger" })).toBeVisible();
      await app.shot("smoke-overview");
    },
  },
  {
    name: "events: eventsiden med sted, valgt ved afstemning",
    as: "jesper",
    drive: async (app) => {
      const { page } = app;
      await app.goto(`${DRENGENE}/events/${EVENTS.next13.id}`);
      await expect(
        page.getByRole("heading", { level: 1, name: EVENTS.next13.title }),
      ).toBeVisible();
      await expect(page.getByText("Hos Jesper").first()).toBeVisible();
      await expect(page.getByText("Valgt ved afstemning 🗳")).toBeVisible();
      await expect(page.getByRole("region", { name: "Øl smagt til dette event" })).toBeVisible();
      await app.shot("smoke-event");
    },
  },
  {
    name: "beers: kataloget har 9 øl, Westmalle har 3 ratings",
    as: "jesper",
    drive: async (app) => {
      const { page } = app;
      await app.goto(`${DRENGENE}/beers`);
      await expect(page.getByRole("heading", { level: 1, name: "Ølkatalog" })).toBeVisible();
      await expect(page.getByText("9 øl", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("link", { name: new RegExp(BEERS.mikkeller.name) }),
      ).toBeVisible();
      await page.getByRole("link", { name: new RegExp(BEERS.westmalle.name) }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: BEERS.westmalle.name }),
      ).toBeVisible();
      await expect(page.getByRole("radio", { name: "5 ud af 5", exact: true })).toBeChecked();
      const [row] = await app.sql<{ count: string }>(
        "SELECT count(*) FROM beer_ratings WHERE beer_id = $1",
        [BEERS.westmalle.id],
      );
      if (row?.count !== "3") throw new Error(`forventede 3 ratings i databasen, så ${row?.count}`);
      await app.shot("smoke-beer");
    },
  },
  {
    name: "polls: åben afstemning, 2 af 3 har stemt",
    as: "jesper",
    drive: async (app) => {
      const { page } = app;
      await app.goto(`${DRENGENE}/polls/${POLLS.open.id}`);
      await expect(page.getByRole("heading", { level: 1, name: POLLS.open.title })).toBeVisible();
      await expect(page.getByText("2 af 3 har stemt")).toBeVisible();
      await expect(page.getByRole("button", { name: "Gem min stemme" })).toBeVisible();
      await app.shot("smoke-poll");
    },
  },
  {
    name: "songs: sangbogen finder en sang, læsevisningen åbner",
    as: "mads",
    drive: async (app) => {
      const { page } = app;
      await app.goto(`${TORSDAG}/songs`);
      await expect(page.getByRole("heading", { level: 1, name: "Sangbog" })).toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(SONGS.aalborg.title) })).toBeVisible();
      await page.getByLabel("Søg i sangbogen").fill("kaptajnen");
      await expect(page).toHaveURL(/[?&]q=kaptajnen/);
      await page
        .getByRole("link", { name: new RegExp(SONGS.skaal.title) })
        .first()
        .click();
      await expect(page.getByRole("heading", { level: 1, name: SONGS.skaal.title })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Forrige og næste sang" })).toBeVisible();
      await app.shot("smoke-song");
    },
  },
];

/**
 * Drives every journey once, each in its own browser, and fails on missing
 * content or any console error, page error or failed request. Screenshots go
 * to .flow/verify/<id>/smoke-*.png.
 */
export async function smoke(id: string, options: { headed?: boolean }): Promise<never> {
  const report = createReport();
  const problems: string[] = [];
  for (const journey of JOURNEYS) {
    const app = await openApp(id, { as: journey.as, headed: options.headed });
    try {
      await report.check(journey.name, () => journey.drive(app));
    } finally {
      problems.push(...app.problems());
      await app.close();
    }
  }
  return report.finish(problems);
}
