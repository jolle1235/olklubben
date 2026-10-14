import { describe, expect, it } from "vitest";

import {
  checkPollTiming,
  dateOptionInstants,
  nextPollDate,
  suggestDeadline,
  suggestPollDates,
  timeLeft,
  usualWeekday,
} from "./schedule";

/**
 * Wall clock ↔ UTC only goes through domain/events/time.ts, so these results
 * do not depend on the machine's time zone (F-034). Verified by running the
 * file under TZ=UTC and TZ=America/New_York.
 */

const at = (iso: string) => new Date(iso);
const MIN = 60_000;
const HOUR = 60 * MIN;

describe("checkPollTiming (§9.7.1, E24)", () => {
  const now = at("2026-10-14T10:00:00.000Z");
  const first = at("2026-10-24T16:30:00.000Z");
  const later = at("2026-10-31T17:30:00.000Z");
  const deadline = at("2026-10-22T18:00:00.000Z");

  it("accepts future dates with a deadline before the first", () => {
    expect(checkPollTiming({ now, deadline, dateStartsAt: [later, first] })).toBeNull();
  });

  it("refuses a date in the past or exactly now (DATE_PAST first)", () => {
    expect(checkPollTiming({ now, deadline, dateStartsAt: [first, now] })).toBe("DATE_PAST");
    expect(
      checkPollTiming({ now, deadline: now, dateStartsAt: [at("2026-10-01T00:00:00Z")] }),
    ).toBe("DATE_PAST");
  });

  it("refuses a deadline that has passed or is now", () => {
    expect(checkPollTiming({ now, deadline: now, dateStartsAt: [first] })).toBe("DEADLINE_PAST");
    expect(
      checkPollTiming({ now, deadline: new Date(now.getTime() - 1), dateStartsAt: [first] }),
    ).toBe("DEADLINE_PAST");
  });

  it("refuses a deadline at or after the earliest date", () => {
    expect(checkPollTiming({ now, deadline: first, dateStartsAt: [later, first] })).toBe(
      "DEADLINE_NOT_BEFORE_FIRST_DATE",
    );
    expect(
      checkPollTiming({ now, deadline: new Date(first.getTime() - 1), dateStartsAt: [first] }),
    ).toBeNull();
  });

  it("refuses a shorter deadline on edit, but an equal or later one is fine", () => {
    const previousDeadline = deadline;
    expect(
      checkPollTiming({
        now,
        deadline: new Date(deadline.getTime() - MIN),
        dateStartsAt: [first],
        previousDeadline,
      }),
    ).toBe("DEADLINE_SHORTENED");
    expect(checkPollTiming({ now, deadline, dateStartsAt: [first], previousDeadline })).toBeNull();
    expect(
      checkPollTiming({
        now,
        deadline: new Date(deadline.getTime() + HOUR),
        dateStartsAt: [first],
        previousDeadline,
      }),
    ).toBeNull();
  });
});

describe("dateOptionInstants (D-039, D-069, E20)", () => {
  it("converts Copenhagen wall clock across the October change", () => {
    expect(
      dateOptionInstants(["2026-10-31", "2026-10-24"], "18:30").map((d) => d.toISOString()),
    ).toEqual(["2026-10-24T16:30:00.000Z", "2026-10-31T17:30:00.000Z"]);
  });

  it("deduplicates and skips invalid keys", () => {
    expect(
      dateOptionInstants(["2026-10-24", "2026-10-24", "2026-02-30"], "18:30").map((d) =>
        d.toISOString(),
      ),
    ).toEqual(["2026-10-24T16:30:00.000Z"]);
  });

  it("takes the first occurrence of an ambiguous time and moves a gap time forward", () => {
    expect(dateOptionInstants(["2026-10-25"], "02:30")[0]?.toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
    expect(dateOptionInstants(["2026-03-29"], "02:30")[0]?.toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });
});

describe("suggestPollDates (D-135)", () => {
  it("falls back to Saturdays, the first at least 7 days ahead", () => {
    // 2026-10-14 is a Wednesday; +7 = Wednesday 21/10 → the Saturday after.
    expect(suggestPollDates({ today: "2026-10-14", pastStarts: [] })).toEqual([
      "2026-10-24",
      "2026-10-31",
      "2026-11-07",
    ]);
  });

  it("uses the club's most common Copenhagen weekday", () => {
    const fridays = [at("2026-10-02T16:30:00Z"), at("2026-09-18T16:30:00Z")];
    const tuesday = at("2026-09-08T16:30:00Z");
    expect(suggestPollDates({ today: "2026-10-14", pastStarts: [...fridays, tuesday] })).toEqual([
      "2026-10-23",
      "2026-10-30",
      "2026-11-06",
    ]);
  });

  it("counts the weekday in Copenhagen, not in UTC", () => {
    // Friday 22:30Z = Saturday 00:30 in Copenhagen.
    expect(usualWeekday([at("2026-10-02T22:30:00Z")])).toBe(6);
    expect(usualWeekday([at("2026-10-02T21:30:00Z")])).toBe(5);
  });

  it("breaks a tie by the most recent start", () => {
    const olderThursday = at("2026-09-03T16:30:00Z");
    const newerTuesday = at("2026-10-06T16:30:00Z");
    expect(usualWeekday([olderThursday, newerTuesday])).toBe(2);
    expect(usualWeekday([newerTuesday, olderThursday])).toBe(2);
  });

  it("starts on the day itself when today + 7 is that weekday", () => {
    // 2026-10-17 is a Saturday; +7 = Saturday 24/10.
    expect(suggestPollDates({ today: "2026-10-17", pastStarts: [] })[0]).toBe("2026-10-24");
  });
});

describe("nextPollDate", () => {
  it("adds one week after the last date, or today + 7 without dates", () => {
    expect(nextPollDate("2026-10-31", "2026-10-14")).toBe("2026-11-07");
    expect(nextPollDate(null, "2026-10-14")).toBe("2026-10-21");
    expect(nextPollDate("2026-12-29", "2026-10-14")).toBe("2027-01-05");
  });
});

describe("suggestDeadline (D-135)", () => {
  const first = "2026-10-24";

  it("suggests two days before at 20:00 when there is time", () => {
    expect(
      suggestDeadline({ firstDate: first, startTime: "18:30", now: at("2026-10-14T10:00Z") }),
    ).toEqual({ date: "2026-10-22", time: "20:00" });
  });

  it("clamps to the day before, then to 3 hours before the start", () => {
    // 22/10 20:00 = 18:00Z, which is not after now + 1 h.
    expect(
      suggestDeadline({ firstDate: first, startTime: "18:30", now: at("2026-10-22T18:00Z") }),
    ).toEqual({ date: "2026-10-23", time: "20:00" });
    expect(
      suggestDeadline({ firstDate: first, startTime: "18:30", now: at("2026-10-23T18:30Z") }),
    ).toEqual({ date: "2026-10-24", time: "15:30" });
  });

  it("gives null when nothing fits, or for invalid input", () => {
    expect(
      suggestDeadline({ firstDate: first, startTime: "18:30", now: at("2026-10-24T13:00Z") }),
    ).toBeNull();
    expect(
      suggestDeadline({
        firstDate: "2026-02-30",
        startTime: "18:30",
        now: at("2026-01-01T00:00Z"),
      }),
    ).toBeNull();
    expect(
      suggestDeadline({ firstDate: first, startTime: "25:00", now: at("2026-01-01T00:00Z") }),
    ).toBeNull();
  });
});

describe("timeLeft", () => {
  const now = at("2026-10-14T10:00:00.000Z");
  const plus = (ms: number) => new Date(now.getTime() + ms);

  it("counts elapsed days and hours from 24 hours", () => {
    expect(timeLeft(plus(24 * HOUR), now)).toEqual({ kind: "days", days: 1, hours: 0 });
    expect(timeLeft(plus(3 * 24 * HOUR + 4 * HOUR + 59 * MIN), now)).toEqual({
      kind: "days",
      days: 3,
      hours: 4,
    });
  });

  it("counts hours from 60 minutes and minutes below", () => {
    expect(timeLeft(plus(24 * HOUR - 1), now)).toEqual({ kind: "hours", hours: 23 });
    expect(timeLeft(plus(60 * MIN), now)).toEqual({ kind: "hours", hours: 1 });
    expect(timeLeft(plus(60 * MIN - 1), now)).toEqual({ kind: "minutes", minutes: 59 });
    expect(timeLeft(plus(30_000), now)).toEqual({ kind: "minutes", minutes: 0 });
  });

  it("is passed at and after the deadline", () => {
    expect(timeLeft(now, now)).toEqual({ kind: "passed" });
    expect(timeLeft(plus(-HOUR), now)).toEqual({ kind: "passed" });
    expect(timeLeft(new Date(Number.NaN), now)).toEqual({ kind: "passed" });
  });

  it("is elapsed time across the DST change (25 hours = 1 day, 1 hour)", () => {
    const before = at("2026-10-24T22:00:00.000Z");
    expect(timeLeft(new Date(before.getTime() + 25 * HOUR), before)).toEqual({
      kind: "days",
      days: 1,
      hours: 1,
    });
  });
});
