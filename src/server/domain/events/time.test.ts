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

describe("resolveEventTimes", () => {
  it("without an end time, endsAt is null", () => {
    const result = resolveEventTimes({ date: "2026-10-23", startTime: "18:30", endTime: "" });
    expect(result).toEqual({
      ok: true,
      startsAt: new Date("2026-10-23T16:30:00Z"),
      endsAt: null,
      endsNextDay: false,
    });
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "18:30" }).ok).toBe(true);
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "18:30", endTime: null }).ok).toBe(
      true,
    );
  });

  it("an end time later the same evening ends the same day", () => {
    const result = resolveEventTimes({ date: "2026-10-23", startTime: "18:30", endTime: "23:00" });
    expect(result).toMatchObject({
      ok: true,
      endsAt: new Date("2026-10-23T21:00:00Z"),
      endsNextDay: false,
    });
  });

  it("an end time before the start time ends the next day (18:30–01:00)", () => {
    const result = resolveEventTimes({ date: "2026-10-23", startTime: "18:30", endTime: "01:00" });
    expect(result).toMatchObject({
      ok: true,
      startsAt: new Date("2026-10-23T16:30:00Z"),
      endsAt: new Date("2026-10-23T23:00:00Z"),
      endsNextDay: true,
    });
  });

  it("an overnight event across the October change ends in winter time (E20)", () => {
    // Saturday 24 October 2026, 20:00 CEST → Sunday 25 October, 04:00 CET.
    const result = resolveEventTimes({ date: "2026-10-24", startTime: "20:00", endTime: "04:00" });
    expect(result).toMatchObject({
      ok: true,
      startsAt: new Date("2026-10-24T18:00:00Z"),
      endsAt: new Date("2026-10-25T03:00:00Z"),
      endsNextDay: true,
    });
  });

  it("an overnight event across the March change ends in summer time (E20)", () => {
    // Saturday 28 March 2026, 20:00 CET → Sunday 29 March, 04:00 CEST.
    const result = resolveEventTimes({ date: "2026-03-28", startTime: "20:00", endTime: "04:00" });
    expect(result).toMatchObject({
      ok: true,
      startsAt: new Date("2026-03-28T19:00:00Z"),
      endsAt: new Date("2026-03-29T02:00:00Z"),
    });
  });

  it("refuses an end time equal to the start time", () => {
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "18:30", endTime: "18:30" })).toEqual(
      { ok: false, field: "endTime", reason: "same-as-start" },
    );
  });

  it("names the invalid field", () => {
    expect(resolveEventTimes({ date: "2026-02-30", startTime: "18:30" })).toMatchObject({
      ok: false,
      field: "date",
    });
    expect(resolveEventTimes({ date: "2026-10-23", startTime: "nej" })).toMatchObject({
      ok: false,
      field: "startTime",
    });
    expect(
      resolveEventTimes({ date: "2026-10-23", startTime: "18:30", endTime: "25:00" }),
    ).toMatchObject({ ok: false, field: "endTime", reason: "invalid" });
  });

  it("never returns an end before the start inside the spring-forward gap", () => {
    // 02:30 → 03:30 CEST, but 03:00 is 03:00 CEST: the end would come first.
    expect(
      resolveEventTimes({ date: "2026-03-29", startTime: "02:30", endTime: "03:00" }),
    ).toMatchObject({ ok: false, field: "endTime" });
  });
});

describe("eventTimesToFormValues", () => {
  it("gives the form's date and times back, also for an overnight end", () => {
    expect(
      eventTimesToFormValues({
        startsAt: new Date("2026-10-23T16:30:00Z"),
        endsAt: new Date("2026-10-23T23:00:00Z"),
      }),
    ).toEqual({ date: "2026-10-23", startTime: "18:30", endTime: "01:00" });
    expect(
      eventTimesToFormValues({ startsAt: new Date("2026-10-30T17:30:00Z"), endsAt: null }),
    ).toEqual({ date: "2026-10-30", startTime: "18:30", endTime: "" });
  });

  it("round-trips through resolveEventTimes", () => {
    const stored = {
      startsAt: new Date("2026-10-24T18:00:00Z"),
      endsAt: new Date("2026-10-25T03:00:00Z"),
    };
    const values = eventTimesToFormValues(stored);
    expect(resolveEventTimes(values)).toMatchObject({ ok: true, ...stored });
  });
});
