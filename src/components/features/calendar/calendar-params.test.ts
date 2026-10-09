import { describe, expect, it } from "vitest";

import {
  calendarHistoryHref,
  calendarHref,
  calendarSearch,
  parseCalendarView,
  parsePastParam,
  parseSelectedDay,
  resolveCalendarParams,
} from "./calendar-params";

// 8 October 2026, 23:30 in Copenhagen (summer time): still October there.
const NOW = new Date("2026-10-08T21:30:00Z");
// 31 October 2026, 23:30 UTC = 1 November 00:30 in Copenhagen (winter time).
const NEW_MONTH_IN_CPH = new Date("2026-10-31T23:30:00Z");

describe("parseCalendarView", () => {
  it("accepts list and month", () => {
    expect(parseCalendarView("list")).toBe("list");
    expect(parseCalendarView("month")).toBe("month");
    expect(parseCalendarView(["month", "list"])).toBe("month");
  });

  it("gives null (the responsive default) for anything else", () => {
    for (const value of [undefined, "", "LIST", "week", " month", ["week"], [], 1, null]) {
      expect(parseCalendarView(value)).toBeNull();
    }
  });
});

describe("parseSelectedDay", () => {
  it("accepts a real date inside the month", () => {
    expect(parseSelectedDay("2026-10-23", "2026-10")).toBe("2026-10-23");
    expect(parseSelectedDay(" 2026-10-01 ", "2026-10")).toBe("2026-10-01");
    expect(parseSelectedDay(["2026-10-31", "x"], "2026-10")).toBe("2026-10-31");
  });

  it("ignores days outside the month and invalid dates", () => {
    for (const value of [
      "2026-11-01",
      "2026-09-30",
      "2026-10-32",
      "2026-02-30",
      "2026-10",
      "23",
      "",
      undefined,
      null,
      ["nope"],
    ]) {
      expect(parseSelectedDay(value, "2026-10")).toBeNull();
    }
  });

  it("does not match a month key that is only a prefix", () => {
    // "2026-1" must not accept "2026-10-05".
    expect(parseSelectedDay("2026-10-05", "2026-1")).toBeNull();
  });
});

describe("resolveCalendarParams", () => {
  it("defaults to the responsive view, the current Copenhagen month and no day", () => {
    expect(resolveCalendarParams({}, NOW)).toEqual({
      view: null,
      month: "2026-10",
      day: null,
      past: null,
    });
    expect(resolveCalendarParams({}, NEW_MONTH_IN_CPH).month).toBe("2026-11");
  });

  it("reads view, month and day", () => {
    expect(
      resolveCalendarParams({ view: "month", month: "2027-01", day: "2027-01-15" }, NOW),
    ).toEqual({ view: "month", month: "2027-01", day: "2027-01-15", past: null });
  });

  it("takes the month from ?day when ?month is missing or invalid", () => {
    expect(resolveCalendarParams({ day: "2026-12-24" }, NOW)).toEqual({
      view: null,
      month: "2026-12",
      day: "2026-12-24",
      past: null,
    });
    expect(resolveCalendarParams({ month: "2026-13", day: "2026-12-24" }, NOW).month).toBe(
      "2026-12",
    );
  });

  it("drops a day that is not in the month shown", () => {
    expect(resolveCalendarParams({ month: "2026-11", day: "2026-10-23" }, NOW)).toEqual({
      view: null,
      month: "2026-11",
      day: null,
      past: null,
    });
  });

  it("falls back safely for garbage (untrusted URL)", () => {
    expect(
      resolveCalendarParams(
        { view: ["x"], month: "<script>", day: "1' OR 1=1", past: "<all>" },
        NOW,
      ),
    ).toEqual({ view: null, month: "2026-10", day: null, past: null });
    expect(resolveCalendarParams({ month: ["2026-05", "2026-06"] }, NOW).month).toBe("2026-05");
  });
});

describe("calendarSearch / calendarHref", () => {
  it("builds a stable query string without empty values", () => {
    expect(calendarSearch({})).toBe("");
    expect(calendarSearch({ view: null, month: undefined, day: null })).toBe("");
    expect(calendarSearch({ day: "2026-10-23", month: "2026-10", view: "month" })).toBe(
      "?view=month&month=2026-10&day=2026-10-23",
    );
    expect(calendarSearch({ view: "list" })).toBe("?view=list");
  });

  it("prefixes the club's calendar path", () => {
    expect(calendarHref("c1")).toBe("/c/c1/calendar");
    expect(calendarHref("c1", { month: "2026-11" })).toBe("/c/c1/calendar?month=2026-11");
  });

  it("round-trips through resolveCalendarParams", () => {
    const params = { view: "list", month: "2026-12", day: "2026-12-05", past: "all" } as const;
    const query = new URLSearchParams(calendarSearch(params));
    expect(resolveCalendarParams(Object.fromEntries(query), NOW)).toEqual(params);
  });
});

describe("history (?past=all, #tidligere)", () => {
  it("accepts only 'all'; anything else is the default", () => {
    expect(parsePastParam("all")).toBe("all");
    expect(parsePastParam(["all", "x"])).toBe("all");
    for (const value of [undefined, "", "ALL", " all", "12", ["x", "all"], null, 1]) {
      expect(parsePastParam(value)).toBeNull();
    }
    expect(resolveCalendarParams({ view: "list", past: "all" }, NOW).past).toBe("all");
  });

  it("puts past last in the query string", () => {
    expect(calendarSearch({ past: "all", view: "list" })).toBe("?view=list&past=all");
    expect(calendarSearch({ past: null, view: "list" })).toBe("?view=list");
  });

  it("links to the list view's history section", () => {
    expect(calendarHistoryHref("c1")).toBe("/c/c1/calendar?view=list#tidligere");
    expect(calendarHistoryHref("c1", { all: true })).toBe(
      "/c/c1/calendar?view=list&past=all#tidligere",
    );
  });
});
