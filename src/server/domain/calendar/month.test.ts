import { describe, expect, it } from "vitest";

import {
  addMonthsToKey,
  isoWeekOfDateKey,
  monthFirstDateKey,
  monthGrid,
  monthGridRange,
  monthKeyLabel,
  monthKeyOf,
  monthRange,
  monthStart,
  nextMonthKey,
  parseMonthKey,
  prevMonthKey,
  WEEKDAYS,
} from "./month";

const NOW = new Date("2026-10-08T10:00:00Z");

describe("parseMonthKey", () => {
  it("accepts YYYY-MM", () => {
    expect(parseMonthKey("2026-10")).toBe("2026-10");
    expect(parseMonthKey(" 2027-01 ")).toBe("2027-01");
  });

  it("rejects anything else (untrusted ?month=)", () => {
    for (const value of [
      "2026-13",
      "2026-00",
      "2026-1",
      "26-10",
      "2026-10-01",
      "oktober",
      "",
      "1899-12",
      "3000-01",
      "<script>",
      null,
      undefined,
      202610,
      ["2026-10"],
    ]) {
      expect(parseMonthKey(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe("monthKeyOf", () => {
  it("uses the Copenhagen month", () => {
    expect(monthKeyOf(new Date("2026-10-15T12:00:00Z"))).toBe("2026-10");
    // 23:30 UTC on 31 October is 00:30 on 1 November in Copenhagen.
    expect(monthKeyOf(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
    expect(monthKeyOf(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01");
  });
});

describe("previous / next month", () => {
  it("moves across years", () => {
    expect(prevMonthKey("2026-01")).toBe("2025-12");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(nextMonthKey("2026-10")).toBe("2026-11");
    expect(addMonthsToKey("2026-10", -22)).toBe("2024-12");
    expect(addMonthsToKey("2026-10", 15)).toBe("2028-01");
  });
});

describe("monthStart / monthRange / monthKeyLabel", () => {
  it("starts at local midnight on the 1st (summer and winter time)", () => {
    expect(monthFirstDateKey("2026-10")).toBe("2026-10-01");
    expect(monthStart("2026-10").toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(monthStart("2026-11").toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("is a half-open range to the next month", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("labels the month in Danish", () => {
    expect(monthKeyLabel("2026-10")).toBe("oktober 2026");
    expect(monthKeyLabel("2027-01")).toBe("januar 2027");
  });

  it("ends the last month (2999-12) after every possible event", () => {
    // 3000-01 is out of range, so the end cannot be the next month's start.
    const { start, end } = monthRange("2999-12");
    expect(start.toISOString()).toBe("2999-11-30T23:00:00.000Z");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(end.getTime()).toBeGreaterThan(Date.parse("2999-12-31T22:59:00Z"));
  });
});

describe("monthGrid", () => {
  it("starts on Monday and ends on Sunday", () => {
    // October 2026: Thursday the 1st, Saturday the 31st.
    const weeks = monthGrid("2026-10");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.days[0]).toMatchObject({
      dateKey: "2026-09-28",
      day: 28,
      weekday: 0,
      inMonth: false,
    });
    expect(weeks[0]?.days[3]).toMatchObject({ dateKey: "2026-10-01", inMonth: true });
    expect(weeks.at(-1)?.days[6]).toMatchObject({ dateKey: "2026-11-01", inMonth: false });
    for (const week of weeks) expect(week.days).toHaveLength(7);
  });

  it("has consecutive days across the October clock change", () => {
    const keys = monthGrid("2026-10").flatMap((week) => week.days.map((day) => day.dateKey));
    expect(keys).toContain("2026-10-25");
    expect(keys).toContain("2026-10-26");
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.indexOf("2026-10-26") - keys.indexOf("2026-10-25")).toBe(1);
  });

  it("gives four weeks to a February that starts on Monday", () => {
    // February 2027: Monday the 1st, 28 days.
    const weeks = monthGrid("2027-02");
    expect(weeks).toHaveLength(4);
    expect(weeks.every((week) => week.days.every((day) => day.inMonth))).toBe(true);
  });

  it("gives six weeks when the month needs them", () => {
    // August 2026: Saturday the 1st, 31 days.
    expect(monthGrid("2026-08")).toHaveLength(6);
  });

  it("marks today in Copenhagen", () => {
    const days = monthGrid("2026-10", NOW).flatMap((week) => week.days);
    expect(days.filter((day) => day.isToday).map((day) => day.dateKey)).toEqual(["2026-10-08"]);
    // 22:30 UTC on 24 October is 25 October in Copenhagen.
    const late = monthGrid("2026-10", new Date("2026-10-24T22:30:00Z")).flatMap((w) => w.days);
    expect(late.find((day) => day.isToday)?.dateKey).toBe("2026-10-25");
    expect(monthGrid("2026-10").some((week) => week.days.some((day) => day.isToday))).toBe(false);
  });

  it("fills the last month (2999-12) although its grid runs into year 3000", () => {
    // December 2999: Sunday the 1st, Tuesday the 31st.
    const weeks = monthGrid("2999-12");
    expect(weeks).toHaveLength(6);
    for (const week of weeks) expect(week.days).toHaveLength(7);
    const days = weeks.flatMap((week) => week.days);
    expect(days[0]).toMatchObject({ dateKey: "2999-11-25", inMonth: false });
    expect(days.find((day) => day.dateKey === "2999-12-01")).toMatchObject({ inMonth: true });
    expect(days.find((day) => day.dateKey === "2999-12-31")).toMatchObject({ inMonth: true });
    expect(days.at(-1)).toMatchObject({ dateKey: "3000-01-05", inMonth: false });
  });

  it("starts the first month (1900-01) on its Monday the 1st", () => {
    const weeks = monthGrid("1900-01");
    expect(weeks[0]?.days[0]).toMatchObject({ dateKey: "1900-01-01", inMonth: true });
    expect(weeks.at(-1)?.days.at(-1)?.dateKey).toBe("1900-02-04");
  });

  it("numbers the weeks the ISO (Danish) way", () => {
    expect(monthGrid("2026-10").map((week) => week.weekNumber)).toEqual([40, 41, 42, 43, 44]);
    // 1 January 2027 is a Friday in week 53 of 2026.
    expect(monthGrid("2027-01")[0]?.weekNumber).toBe(53);
  });
});

describe("isoWeekOfDateKey", () => {
  it("follows ISO 8601", () => {
    expect(isoWeekOfDateKey("2026-10-26")).toBe(44);
    expect(isoWeekOfDateKey("2026-01-01")).toBe(1);
    expect(isoWeekOfDateKey("2027-01-01")).toBe(53);
    expect(isoWeekOfDateKey("nope")).toBeNaN();
  });
});

describe("monthGridRange", () => {
  it("covers the neighbouring months' days in the grid", () => {
    const { start, end } = monthGridRange("2026-10");
    // Monday 28 September 00:00 CEST → Monday 2 November 00:00 CET.
    expect(start.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });

  it("covers the last month's grid (2999-12) to after its last day", () => {
    const { start, end } = monthGridRange("2999-12");
    // Monday 25 November 2999 00:00 CET.
    expect(start.toISOString()).toBe("2999-11-24T23:00:00.000Z");
    // Past Copenhagen's midnight into 1 January 3000 (no event can be later).
    expect(end.getTime()).toBeGreaterThan(Date.parse("2999-12-31T23:00:00Z"));
  });

  it("starts the first month's grid (1900-01) on 1 January 1900", () => {
    const { start, end } = monthGridRange("1900-01");
    expect(start.toISOString()).toBe("1899-12-31T23:00:00.000Z");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("WEEKDAYS", () => {
  it("is Monday first", () => {
    expect(WEEKDAYS.map((day) => day.short)).toEqual([
      "man",
      "tir",
      "ons",
      "tor",
      "fre",
      "lør",
      "søn",
    ]);
  });
});
