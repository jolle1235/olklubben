import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  DEFAULT_EVENT_START_TIME,
  eventTimesToFormValues,
  isDateKey,
  normalizeTimeOfDay,
  parseDateKey,
  parseTimeOfDay,
  resolveEventTimes,
  utcToZonedParts,
  zonedDateTimeToUtc,
} from "./time";

const iso = (date: Date | null) => date?.toISOString() ?? null;

describe("parseDateKey / isDateKey", () => {
  it("accepts real calendar dates", () => {
    expect(parseDateKey("2026-10-23")).toEqual({ year: 2026, month: 10, day: 23 });
    expect(parseDateKey(" 2028-02-29 ")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(isDateKey("2026-12-31")).toBe(true);
  });

  it("rejects impossible dates and other formats", () => {
    for (const value of [
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-00-10",
      "2026-1-5",
      "23/10/2026",
      "",
      "1899-12-31",
      "3000-01-01",
      null,
      20261023,
    ]) {
      expect(parseDateKey(value), String(value)).toBeNull();
    }
  });
});

describe("parseTimeOfDay / normalizeTimeOfDay", () => {
  it("accepts HH:mm, H:mm, HH:mm:ss and the Danish 18.30", () => {
    expect(parseTimeOfDay("18:30")).toEqual({ hour: 18, minute: 30 });
    expect(normalizeTimeOfDay("8:05")).toBe("08:05");
    expect(normalizeTimeOfDay("18:30:59")).toBe("18:30");
    expect(normalizeTimeOfDay("18.30")).toBe("18:30");
    expect(normalizeTimeOfDay("00:00")).toBe("00:00");
    expect(normalizeTimeOfDay("23:59")).toBe("23:59");
  });

  it("rejects impossible times", () => {
    for (const value of ["24:00", "18:60", "18:3", "1830", "", "kl. 18", null]) {
      expect(normalizeTimeOfDay(value), String(value)).toBeNull();
    }
  });

  it("has 18:30 as the default start time (SPEC §9.2)", () => {
    expect(DEFAULT_EVENT_START_TIME).toBe("18:30");
  });
});

describe("addDaysToDateKey", () => {
  it("moves across months and years", () => {
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToDateKey("nope", 1)).toBeNull();
  });
});

describe("zonedDateTimeToUtc (SPEC §4.6, E20)", () => {
  it("18:30 is 16:30 UTC in summer time and 17:30 UTC in winter time", () => {
    expect(iso(zonedDateTimeToUtc("2026-10-23", "18:30"))).toBe("2026-10-23T16:30:00.000Z");
    expect(iso(zonedDateTimeToUtc("2026-10-30", "18:30"))).toBe("2026-10-30T17:30:00.000Z");
    expect(iso(zonedDateTimeToUtc("2026-03-28", "18:30"))).toBe("2026-03-28T17:30:00.000Z");
    expect(iso(zonedDateTimeToUtc("2026-03-29", "18:30"))).toBe("2026-03-29T16:30:00.000Z");
  });

  it("midnight is the start of the Copenhagen day", () => {
    expect(iso(zonedDateTimeToUtc("2026-10-25", "00:00"))).toBe("2026-10-24T22:00:00.000Z");
    expect(iso(zonedDateTimeToUtc("2027-01-01", "00:00"))).toBe("2026-12-31T23:00:00.000Z");
  });

  it("moves a time in the spring-forward gap forward (29 March 2026, 02:00 → 03:00)", () => {
    expect(iso(zonedDateTimeToUtc("2026-03-29", "01:59"))).toBe("2026-03-29T00:59:00.000Z");
    // 02:30 does not exist; it becomes 03:30 summer time (01:30 UTC).
    expect(iso(zonedDateTimeToUtc("2026-03-29", "02:30"))).toBe("2026-03-29T01:30:00.000Z");
    expect(iso(zonedDateTimeToUtc("2026-03-29", "03:00"))).toBe("2026-03-29T01:00:00.000Z");
  });

  it("takes the first (summer time) 02:30 on 25 October 2026", () => {
    expect(iso(zonedDateTimeToUtc("2026-10-25", "01:30"))).toBe("2026-10-24T23:30:00.000Z");
    // 02:30 happens at 00:30 UTC (CEST) and again at 01:30 UTC (CET).
    expect(iso(zonedDateTimeToUtc("2026-10-25", "02:30"))).toBe("2026-10-25T00:30:00.000Z");
    expect(iso(zonedDateTimeToUtc("2026-10-25", "03:00"))).toBe("2026-10-25T02:00:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(zonedDateTimeToUtc("2026-02-30", "18:30")).toBeNull();
    expect(zonedDateTimeToUtc("2026-10-23", "25:00")).toBeNull();
  });
});

describe("utcToZonedParts", () => {
  it("splits an instant into the Copenhagen date and time", () => {
    expect(utcToZonedParts(new Date("2026-10-23T16:30:00Z"))).toEqual({
      date: "2026-10-23",
      time: "18:30",
    });
    // 22:30 UTC in summer time is 00:30 the next day.
    expect(utcToZonedParts(new Date("2026-10-24T22:30:00Z"))).toEqual({
      date: "2026-10-25",
      time: "00:30",
    });
    // Both 02:30s on 25 October read as 02:30.
    expect(utcToZonedParts(new Date("2026-10-25T00:30:00Z")).time).toBe("02:30");
    expect(utcToZonedParts(new Date("2026-10-25T01:30:00Z")).time).toBe("02:30");
  });

  it("round-trips with zonedDateTimeToUtc across the year", () => {
    for (const [date, time] of [
      ["2026-01-15", "19:00"],
      ["2026-03-29", "18:30"],
      ["2026-07-04", "12:15"],
      ["2026-10-25", "18:30"],
      ["2026-12-31", "23:59"],
    ] as const) {
      const instant = zonedDateTimeToUtc(date, time);
      expect(instant).not.toBeNull();
      expect(utcToZonedParts(instant as Date)).toEqual({ date, time });
    }
  });
});

describe("resolveEventTimes (D-176: the end is always explicit)", () => {
  const start = { date: "2026-10-23", startTime: "18:30" };

  it("without an end, endsAt is null", () => {
    expect(resolveEventTimes(start)).toEqual({
      ok: true,
      startsAt: new Date("2026-10-23T16:30:00Z"),
      endsAt: null,
      hasStartTime: true,
    });
    expect(resolveEventTimes({ ...start, endDate: "", endTime: null }).ok).toBe(true);
  });

  it("ends on the chosen day and time: the same evening, after midnight or days later", () => {
    const at = (endDate: string, endTime: string) =>
      resolveEventTimes({ ...start, endDate, endTime });
    expect(at("2026-10-23", "23:30")).toMatchObject({ endsAt: new Date("2026-10-23T21:30:00Z") });
    expect(at("2026-10-24", "01:00")).toMatchObject({ endsAt: new Date("2026-10-23T23:00:00Z") });
    expect(at("2026-10-25", "14:00")).toMatchObject({ endsAt: new Date("2026-10-25T13:00:00Z") });
  });

  it("an end across the October change is in winter time (E20)", () => {
    expect(
      resolveEventTimes({
        date: "2026-10-24",
        startTime: "20:00",
        endDate: "2026-10-25",
        endTime: "04:00",
      }),
    ).toMatchObject({
      startsAt: new Date("2026-10-24T18:00:00Z"),
      endsAt: new Date("2026-10-25T03:00:00Z"),
    });
  });

  it("refuses an end at or before the start – no automatic next day", () => {
    for (const end of [
      { endDate: "2026-10-23", endTime: "18:30" },
      { endDate: "2026-10-23", endTime: "01:00" },
    ]) {
      expect(resolveEventTimes({ ...start, ...end })).toEqual({
        ok: false,
        field: "endTime",
        reason: "end-before-start",
      });
    }
    expect(resolveEventTimes({ ...start, endDate: "2026-10-22", endTime: "23:00" })).toEqual({
      ok: false,
      field: "endDate",
      reason: "end-before-start",
    });
  });

  it("wants an end day and an end time together", () => {
    expect(resolveEventTimes({ ...start, endTime: "23:00" })).toEqual({
      ok: false,
      field: "endDate",
      reason: "missing",
    });
    expect(resolveEventTimes({ ...start, endDate: "2026-10-24" })).toEqual({
      ok: false,
      field: "endTime",
      reason: "missing",
    });
  });

  it("names the invalid field", () => {
    expect(resolveEventTimes({ date: "2026-02-30", startTime: "18:30" })).toMatchObject({
      field: "date",
    });
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "25:00" })).toMatchObject({
      field: "startTime",
    });
    expect(resolveEventTimes({ ...start, endDate: "2026-02-30", endTime: "01:00" })).toMatchObject({
      field: "endDate",
    });
    expect(resolveEventTimes({ ...start, endDate: "2026-10-24", endTime: "nej" })).toMatchObject({
      field: "endTime",
    });
  });
});

describe("eventTimesToFormValues", () => {
  it("gives the form's days and times back, and round-trips", () => {
    const stored = {
      startsAt: new Date("2026-10-24T18:00:00Z"),
      endsAt: new Date("2026-10-25T03:00:00Z"),
      hasStartTime: true,
    };
    const values = eventTimesToFormValues(stored);
    expect(values).toEqual({
      date: "2026-10-24",
      startTime: "20:00",
      endDate: "2026-10-25",
      endTime: "04:00",
    });
    expect(resolveEventTimes(values)).toMatchObject({ ok: true, ...stored });
    expect(
      eventTimesToFormValues({ startsAt: stored.startsAt, endsAt: null, hasStartTime: true }),
    ).toEqual({ date: "2026-10-24", startTime: "20:00", endDate: "", endTime: "" });
  });
});

describe("without a start time (D-175)", () => {
  it("spans the Copenhagen date, or until the end day, also across a clock change", () => {
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "" })).toEqual({
      ok: true,
      startsAt: new Date("2026-10-22T22:00:00Z"),
      endsAt: new Date("2026-10-23T22:00:00Z"),
      hasStartTime: false,
    });
    // Friday to Sunday 25 October, which has 25 hours (summer time ends).
    expect(
      resolveEventTimes({ date: "2026-10-23", startTime: null, endDate: "2026-10-25" }),
    ).toMatchObject({
      startsAt: new Date("2026-10-22T22:00:00Z"),
      endsAt: new Date("2026-10-25T23:00:00Z"),
    });
  });

  it("refuses an end time", () => {
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "", endTime: "23:00" })).toEqual({
      ok: false,
      field: "endTime",
      reason: "end-without-start",
    });
  });

  it("gives the times back to the edit form, and round-trips", () => {
    for (const [endsAt, endDate] of [
      [new Date("2026-10-23T22:00:00Z"), ""],
      [new Date("2026-10-25T23:00:00Z"), "2026-10-25"],
    ] as const) {
      const stored = { startsAt: new Date("2026-10-22T22:00:00Z"), endsAt, hasStartTime: false };
      const values = eventTimesToFormValues(stored);
      expect(values).toEqual({ date: "2026-10-23", startTime: "", endDate, endTime: "" });
      expect(resolveEventTimes(values)).toMatchObject({ ok: true, ...stored });
    }
  });
});
