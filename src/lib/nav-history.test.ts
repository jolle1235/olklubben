import { describe, expect, it } from "vitest";

import { backTarget, isSongPage, parentPage, recordVisit } from "./nav-history";

const club = "/c/c1";
const event = `${club}/events/e1`;
const fallback = `${club}/calendar`;

describe("recordVisit", () => {
  it("pushes a new page and ignores a repeat of the current one", () => {
    expect(recordVisit([], club)).toEqual([club]);
    expect(recordVisit([club], `${club}/calendar`)).toEqual([club, `${club}/calendar`]);
    expect(recordVisit([club], club)).toEqual([club]);
  });

  it("replaces the current page when only its query changes (toast removed, month browsed)", () => {
    expect(recordVisit([club, `${event}?toast=event-created`], event)).toEqual([club, event]);
    expect(recordVisit([`${club}/calendar`], `${club}/calendar?view=month`)).toEqual([
      `${club}/calendar?view=month`,
    ]);
  });

  it("rewinds to an earlier visit when only forms and beers came after it", () => {
    expect(recordVisit([club, event, `${club}/beers/b1?from=event`], event)).toEqual([club, event]);
    const tasting = [club, event, `${club}/beers/new?eventId=e1`, `${club}/beers/b1`];
    expect(recordVisit(tasting, event)).toEqual([club, event]);
  });

  it("rewinds over side trips from the event: its place, its poll, another event (bugs-r2-1)", () => {
    for (const sideTrip of [`${club}/places/p1`, `${club}/polls/q1`, `${club}/events/e2`]) {
      expect(recordVisit([`${club}/calendar`, event, sideTrip], event)).toEqual([
        `${club}/calendar`,
        event,
      ]);
    }
  });

  it("pushes a new visit to an earlier page when a main page came in between", () => {
    const stack = [`${club}/calendar`, event, club];
    expect(recordVisit(stack, event)).toEqual([...stack, event]);
  });

  it("keeps at most 20 entries", () => {
    const long = Array.from({ length: 20 }, (_, i) => `${club}/p${i}`);
    const next = recordVisit(long, `${club}/new-page`);
    expect(next).toHaveLength(20);
    expect(next.at(-1)).toBe(`${club}/new-page`);
    expect(next[0]).toBe(`${club}/p1`);
  });
});

describe("backTarget", () => {
  it("goes to the page the event was opened from", () => {
    expect(backTarget([`${club}/places/p1`], event, club, fallback)).toBe(`${club}/places/p1`);
    // The tracker may already have recorded the event itself.
    expect(backTarget([club, event], event, club, fallback)).toBe(club);
  });

  it("keeps the query of the page it goes back to", () => {
    expect(backTarget([`${club}/calendar?view=month`], event, club, fallback)).toBe(
      `${club}/calendar?view=month`,
    );
  });

  it("does not bounce between the event and a beer opened from it", () => {
    const stack = [`${club}/places/p1`, event, `${club}/beers/b1?from=event`];
    expect(backTarget(stack, event, club, fallback)).toBe(`${club}/places/p1`);
  });

  it("goes to where the tasting started after adding a beer and returning via the beer (bugs-1)", () => {
    let stack: string[] = [];
    for (const url of [
      `${club}/calendar`,
      event,
      `${club}/beers/new?eventId=e1`,
      `${club}/beers/b1`,
    ]) {
      stack = recordVisit(stack, url);
    }
    expect(backTarget(stack, event, club, fallback)).toBe(`${club}/calendar`);
  });

  it("does not bounce between the event and its place (bugs-r2-1)", () => {
    let stack: string[] = [];
    for (const url of [
      `${club}/calendar`,
      event,
      `${club}/places/p1`,
      event,
      `${club}/places/p1`,
    ]) {
      stack = recordVisit(stack, url);
    }
    expect(backTarget(stack, event, club, fallback)).toBe(`${club}/calendar`);
  });

  it("goes to a main page reached via a side trip, e.g. Steder → place → event", () => {
    const stack = [`${club}/places`, `${club}/places/p1`];
    expect(backTarget(stack, event, club, fallback)).toBe(`${club}/places/p1`);
  });

  it("goes to the page the event was opened from this time (bugs-2, intent-1)", () => {
    const visits = [`${club}/calendar`, event, club];
    expect(backTarget(visits, event, club, fallback)).toBe(club);
    const reverse = [club, event, `${club}/calendar`];
    expect(backTarget(reverse, event, club, fallback)).toBe(`${club}/calendar`);
  });

  it("goes past the event itself after its toast left the URL", () => {
    const stack = [club, `${club}/events/new`, `${event}?toast=event-created`];
    expect(backTarget(stack, event, club, fallback)).toBe(club);
  });

  it("skips forms (create, edit, import)", () => {
    expect(backTarget([club, `${club}/events/new`], event, club, fallback)).toBe(club);
    expect(backTarget([club, event, `${event}/edit`], event, club, fallback)).toBe(club);
    expect(backTarget([`${club}/songs/import`], event, club, fallback)).toBe(fallback);
  });

  it("falls back when there is nothing in this club to go back to", () => {
    expect(backTarget([], event, club, fallback)).toBe(fallback);
    expect(backTarget(["/c/other/calendar"], event, club, fallback)).toBe(fallback);
    expect(backTarget(["/c/c10/calendar"], event, club, fallback)).toBe(fallback);
    expect(backTarget(["/feedback"], event, club, fallback)).toBe(fallback);
  });
});

describe("parentPage", () => {
  it("is the area's list, and Indstillinger for its subpages", () => {
    expect(parentPage(event, club)).toBe(`${club}/calendar`);
    expect(parentPage(`${club}/events/new`, club)).toBe(`${club}/calendar`);
    expect(parentPage(`${club}/polls/p1`, club)).toBe(`${club}/calendar`);
    expect(parentPage(`${club}/beers/b1`, club)).toBe(`${club}/beers`);
    expect(parentPage(`${club}/places/p1/edit`, club)).toBe(`${club}/places`);
    expect(parentPage(`${club}/songs/import`, club)).toBe(`${club}/songs`);
    expect(parentPage(`${club}/club/edit`, club)).toBe(`${club}/club`);
    expect(parentPage(`${club}/nope`, club)).toBe(club);
    for (const path of [`${club}/club`, `${club}/places`, `${club}/profile`]) {
      expect(parentPage(path, club), path).toBe(`${club}/settings`);
    }
  });

  it("sends feedback to Indstillinger and a report or the form to the list", () => {
    expect(parentPage("/feedback", club)).toBe(`${club}/settings`);
    expect(parentPage("/feedback/f1", club)).toBe("/feedback");
    expect(parentPage("/feedback/new", club)).toBe("/feedback");
  });
});

describe("isSongPage", () => {
  it("is a song, not the songbook, its forms or another area", () => {
    expect(isSongPage(`${club}/songs/s1`)).toBe(true);
    for (const path of [
      `${club}/songs`,
      `${club}/songs/new`,
      `${club}/songs/import`,
      `${club}/songs/s1/edit`,
      event,
    ]) {
      expect(isSongPage(path), path).toBe(false);
    }
  });
});

describe("backTarget with feedback", () => {
  const report = "/feedback/5eed0000-0000-7000-8000-0000000002f1";
  it("goes back to the feedback list or a report, outside the club's paths", () => {
    expect(backTarget(["/feedback", report], report, club, fallback)).toBe("/feedback");
    expect(backTarget([`${club}/settings`, "/feedback"], "/feedback", club, fallback)).toBe(
      `${club}/settings`,
    );
  });

  it("never goes to a feedback form or a look-alike path", () => {
    for (const earlier of ["/feedback/new", `${report}/edit`, "/feedbackx"]) {
      expect(backTarget([earlier], report, club, fallback), earlier).toBe(fallback);
    }
  });
});

describe("recordVisit without club and places as main pages", () => {
  it("rewinds Indstillinger → Klubben → Steder → Klubben", () => {
    const stack = [`${club}/settings`, `${club}/club`, `${club}/places`];
    expect(recordVisit(stack, `${club}/club`)).toEqual([`${club}/settings`, `${club}/club`]);
  });

  it("rewinds Kalender → event → Steder → event", () => {
    const stack = [`${club}/calendar`, event, `${club}/places`];
    expect(recordVisit(stack, event)).toEqual([`${club}/calendar`, event]);
  });
});
