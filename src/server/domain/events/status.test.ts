import { describe, expect, it } from "vitest";

import {
  calendarDaysBetween,
  effectiveEnd,
  EVENT_FALLBACK_DURATION_HOURS,
  fallbackStartCutoff,
  hasEnded,
  heroState,
  heroStateLabel,
  isHeroHighlighted,
  isOngoing,
  isUpcomingOrOngoing,
  type HeroState,
} from "./status";

const at = (iso: string) => new Date(iso);

// Friday 23 October 2026, 18:30 in Copenhagen (summer time, UTC+2).
const START = at("2026-10-23T16:30:00Z");
const withEnd = { startsAt: START, endsAt: at("2026-10-23T21:00:00Z") };
const noEnd = { startsAt: START, endsAt: null };

describe("effectiveEnd", () => {
  it("is endsAt when set", () => {
    expect(effectiveEnd(withEnd)).toEqual(at("2026-10-23T21:00:00Z"));
  });

  it("is startsAt + 6 hours without endsAt (SPEC §9.1)", () => {
    expect(EVENT_FALLBACK_DURATION_HOURS).toBe(6);
    expect(effectiveEnd(noEnd)).toEqual(at("2026-10-23T22:30:00Z"));
  });

  it("adds 6 real hours across a clock change", () => {
    // 24 October 22:00 CEST + 6 h = 25 October 03:00 CET (the clock went back).
    expect(effectiveEnd({ startsAt: at("2026-10-24T20:00:00Z"), endsAt: null })).toEqual(
      at("2026-10-25T02:00:00Z"),
    );
  });
});

describe("isUpcomingOrOngoing / isOngoing / hasEnded", () => {
  it("before the start: upcoming, not ongoing", () => {
    const now = at("2026-10-23T10:00:00Z");
    expect(isUpcomingOrOngoing(withEnd, now)).toBe(true);
    expect(isOngoing(withEnd, now)).toBe(false);
    expect(hasEnded(withEnd, now)).toBe(false);
  });

  it("start ≤ now < end: ongoing (the start instant counts)", () => {
    expect(isOngoing(withEnd, START)).toBe(true);
    expect(isOngoing(withEnd, at("2026-10-23T20:59:59Z"))).toBe(true);
  });

  it("at the end it is over (the end instant does not count)", () => {
    const end = at("2026-10-23T21:00:00Z");
    expect(isUpcomingOrOngoing(withEnd, end)).toBe(false);
    expect(isOngoing(withEnd, end)).toBe(false);
    expect(hasEnded(withEnd, end)).toBe(true);
  });

  it("without endsAt it is ongoing for 6 hours", () => {
    expect(isOngoing(noEnd, at("2026-10-23T22:29:00Z"))).toBe(true);
    expect(hasEnded(noEnd, at("2026-10-23T22:30:00Z"))).toBe(true);
  });
});

describe("fallbackStartCutoff", () => {
  it("is now − 6 hours (events without endsAt that started after it are not over)", () => {
    expect(fallbackStartCutoff(at("2026-10-23T22:00:00Z"))).toEqual(at("2026-10-23T16:00:00Z"));
  });
});

describe("calendarDaysBetween", () => {
  it("counts Copenhagen calendar days, not 24-hour blocks", () => {
    // 23:30 → 00:30 the next day (Copenhagen) is one day.
    expect(calendarDaysBetween(at("2026-10-22T21:30:00Z"), at("2026-10-22T22:30:00Z"))).toBe(1);
    // Same Copenhagen day although the UTC dates differ.
    expect(calendarDaysBetween(at("2026-10-23T22:30:00Z"), at("2026-10-23T23:30:00Z"))).toBe(0);
    expect(calendarDaysBetween(at("2026-10-20T10:00:00Z"), START)).toBe(3);
    expect(calendarDaysBetween(START, at("2026-10-20T10:00:00Z"))).toBe(-3);
  });

  it("a day across the October change is still one day (E20)", () => {
    expect(calendarDaysBetween(at("2026-10-24T20:00:00Z"), at("2026-10-25T20:00:00Z"))).toBe(1);
    expect(calendarDaysBetween(at("2026-03-28T20:00:00Z"), at("2026-03-29T20:00:00Z"))).toBe(1);
  });
});

describe("heroState (SPEC §9.1)", () => {
  it("more than one day ahead: inDays", () => {
    expect(heroState(withEnd, at("2026-10-20T10:00:00Z"))).toEqual({ kind: "inDays", days: 3 });
  });

  it("tomorrow, even late in the evening", () => {
    expect(heroState(withEnd, at("2026-10-22T21:59:00Z"))).toEqual({ kind: "tomorrow" });
    expect(heroState(withEnd, at("2026-10-22T06:00:00Z"))).toEqual({ kind: "tomorrow" });
  });

  it("today before the start: tonight (also just after midnight)", () => {
    // 00:30 on 23 October in Copenhagen is still 22 October in UTC.
    expect(heroState(withEnd, at("2026-10-22T22:30:00Z"))).toEqual({ kind: "tonight" });
    expect(heroState(withEnd, at("2026-10-23T16:29:00Z"))).toEqual({ kind: "tonight" });
  });

  it("from the start until the end: ongoing", () => {
    expect(heroState(withEnd, START)).toEqual({ kind: "ongoing" });
    expect(heroState(noEnd, at("2026-10-23T22:00:00Z"))).toEqual({ kind: "ongoing" });
  });

  it("an overnight event is still ongoing after midnight", () => {
    const overnight = { startsAt: START, endsAt: at("2026-10-23T23:00:00Z") };
    expect(heroState(overnight, at("2026-10-23T22:30:00Z"))).toEqual({ kind: "ongoing" });
  });

  it("after the end: ended", () => {
    expect(heroState(withEnd, at("2026-10-24T08:00:00Z"))).toEqual({ kind: "ended" });
  });

  it("counts days across the October change (E20)", () => {
    // Event Monday 26 October 18:30 CET; now Saturday 24 October 12:00 CEST.
    const monday = { startsAt: at("2026-10-26T17:30:00Z"), endsAt: null };
    expect(heroState(monday, at("2026-10-24T10:00:00Z"))).toEqual({ kind: "inDays", days: 2 });
  });
});

describe("heroStateLabel / isHeroHighlighted", () => {
  const cases: [HeroState, string, boolean][] = [
    [{ kind: "ongoing" }, "I gang nu", true],
    [{ kind: "tonight" }, "I aften! 🍻", true],
    [{ kind: "tomorrow" }, "I morgen!", false],
    [{ kind: "inDays", days: 3 }, "om 3 dage", false],
    [{ kind: "inDays", days: 14 }, "om 14 dage", false],
    [{ kind: "ended" }, "Afsluttet", false],
  ];

  it.each(cases)("%o → %s", (state, label, highlighted) => {
    expect(heroStateLabel(state)).toBe(label);
    expect(isHeroHighlighted(state)).toBe(highlighted);
  });
});
