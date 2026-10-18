import { describe, expect, it } from "vitest";

import {
  formatCompactDate,
  formatDate,
  formatDayMonthParts,
  formatLongDate,
  formatMonthLabel,
  formatRelativeDays,
  formatRelativePast,
  formatShortDate,
  formatTime,
  formatTimeRange,
  formatWeekdayDate,
  formatWeekdayDateTime,
  formatWeekday,
  formatWeekdayShort,
  toDateKey,
} from "./date";

describe("formatDate", () => {
  it("formats as Danish day, month and year", () => {
    expect(formatDate(new Date("2026-10-08T10:00:00Z"))).toBe("8. oktober 2026");
    expect(formatDate(new Date("2027-01-31T12:00:00Z"))).toBe("31. januar 2027");
  });

  it("accepts ISO strings and timestamps", () => {
    expect(formatDate("2026-05-17T12:00:00Z")).toBe("17. maj 2026");
    expect(formatDate(Date.UTC(2026, 11, 24, 12))).toBe("24. december 2026");
  });

  it("uses the Copenhagen calendar day, not UTC", () => {
    // 23:30 UTC on 31 December is already New Year in Copenhagen (UTC+1).
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("1. januar 2027");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDate("ikke en dato")).toBe("");
    expect(formatDate(new Date(Number.NaN))).toBe("");
  });
});

describe("formatWeekdayDate", () => {
  it("formats as 'fredag 23. oktober' without 'den' and without year", () => {
    expect(formatWeekdayDate("2026-10-23T16:30:00Z")).toBe("fredag 23. oktober");
    expect(formatWeekdayDate("2026-10-08T10:00:00Z")).toBe("torsdag 8. oktober");
  });
});

describe("formatDayMonthParts", () => {
  it("gives day and month separately, without the day's dot", () => {
    expect(formatDayMonthParts("2026-10-23T16:30:00Z")).toEqual({ day: "23", month: "oktober" });
    expect(formatDayMonthParts(new Date("2026-05-01T10:00:00Z"))).toEqual({
      day: "1",
      month: "maj",
    });
  });

  it("uses the Copenhagen calendar day, also across a month and a year", () => {
    // 22:30 UTC is 00:30 the next day in summer time.
    expect(formatDayMonthParts("2026-10-24T22:30:00Z")).toEqual({ day: "25", month: "oktober" });
    // 23:30 UTC on 31 December is already New Year in Copenhagen.
    expect(formatDayMonthParts("2026-12-31T23:30:00Z")).toEqual({ day: "1", month: "januar" });
  });

  it("returns null for an invalid date", () => {
    expect(formatDayMonthParts("nope")).toBeNull();
    expect(formatDayMonthParts(Number.NaN)).toBeNull();
  });
});

describe("formatTime", () => {
  it("uses a 24-hour clock with a colon", () => {
    expect(formatTime("2026-10-23T16:30:00Z")).toBe("18:30");
    expect(formatTime("2026-10-23T22:05:00Z")).toBe("00:05");
  });
});

describe("summer/winter time (SPEC §4.6, E20)", () => {
  it("18:30 stays 18:30 on both sides of the October change", () => {
    // Summer time (CEST, UTC+2) until 25 October 2026 at 03:00.
    expect(formatWeekdayDateTime("2026-10-23T16:30:00Z")).toBe("fredag 23. oktober kl. 18:30");
    // Winter time (CET, UTC+1) afterwards: same wall clock, one hour later in UTC.
    expect(formatWeekdayDateTime("2026-10-30T17:30:00Z")).toBe("fredag 30. oktober kl. 18:30");
  });

  it("handles the night the clocks go back (25 October 2026)", () => {
    // 02:30 happens twice: first in CEST (00:30 UTC), then in CET (01:30 UTC).
    expect(formatTime("2026-10-25T00:30:00Z")).toBe("02:30");
    expect(formatTime("2026-10-25T01:30:00Z")).toBe("02:30");
    expect(formatTime("2026-10-25T02:30:00Z")).toBe("03:30");
  });

  it("handles the night the clocks go forward (29 March 2026)", () => {
    // 02:00 → 03:00 local: 00:59 UTC is 01:59 CET, 01:00 UTC is 03:00 CEST.
    expect(formatTime("2026-03-29T00:59:00Z")).toBe("01:59");
    expect(formatTime("2026-03-29T01:00:00Z")).toBe("03:00");
  });

  it("puts a late-evening UTC time on the right Copenhagen day in summer and winter", () => {
    // 22:30 UTC is 00:30 the next day in summer (UTC+2) …
    expect(formatDate("2026-10-24T22:30:00Z")).toBe("25. oktober 2026");
    expect(toDateKey("2026-10-24T22:30:00Z")).toBe("2026-10-25");
    // … but still 23:30 the same day in winter (UTC+1).
    expect(formatDate("2026-11-07T22:30:00Z")).toBe("7. november 2026");
    expect(toDateKey("2026-11-07T22:30:00Z")).toBe("2026-11-07");
  });
});

describe("toDateKey", () => {
  it("pads month and day", () => {
    expect(toDateKey("2026-03-05T12:00:00Z")).toBe("2026-03-05");
  });

  it("returns an empty string for an invalid date", () => {
    expect(toDateKey("nope")).toBe("");
  });
});

describe("formatShortDate", () => {
  it("formats as zero-padded day/month (SPEC §9.1 '14/11', '05/12')", () => {
    expect(formatShortDate("2026-11-14T17:00:00Z")).toBe("14/11");
    expect(formatShortDate("2026-12-05T17:00:00Z")).toBe("05/12");
  });

  it("uses the Copenhagen day", () => {
    expect(formatShortDate("2026-10-24T22:30:00Z")).toBe("25/10");
    expect(formatShortDate("nope")).toBe("");
  });
});

describe("formatMonthLabel", () => {
  it("formats as 'oktober 2026' in Copenhagen", () => {
    expect(formatMonthLabel("2026-10-15T12:00:00Z")).toBe("oktober 2026");
    // 23:30 UTC on 31 October (winter time) is already 1 November in Copenhagen.
    expect(formatMonthLabel("2026-10-31T23:30:00Z")).toBe("november 2026");
    expect(formatMonthLabel("nope")).toBe("");
  });
});

describe("formatLongDate", () => {
  const now = new Date("2026-10-08T10:00:00Z");

  it("leaves out the year in the current year", () => {
    expect(formatLongDate("2026-10-23T16:30:00Z", now)).toBe("fredag 23. oktober");
  });

  it("adds the year in another year (also the past)", () => {
    expect(formatLongDate("2027-01-05T17:30:00Z", now)).toBe("tirsdag 5. januar 2027");
    expect(formatLongDate("2025-12-24T17:30:00Z", now)).toBe("onsdag 24. december 2025");
  });

  it("compares Copenhagen years, not UTC years", () => {
    // New Year's Eve 23:30 UTC is already 2027 in Copenhagen, and so is `now`.
    const newYear = new Date("2026-12-31T23:30:00Z");
    expect(formatLongDate("2027-01-01T12:00:00Z", newYear)).toBe("fredag 1. januar");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatLongDate("nope", now)).toBe("");
  });
});

describe("formatWeekday", () => {
  it("gives the Copenhagen weekday, also late in the evening UTC", () => {
    expect(formatWeekday("2026-10-23T16:30:00Z")).toBe("fredag");
    // 00:30 on Saturday in Copenhagen.
    expect(formatWeekday("2026-10-23T22:30:00Z")).toBe("lørdag");
    expect(formatWeekday("nope")).toBe("");
  });
});

describe("formatWeekdayShort", () => {
  it("gives three letters, like the month grid's headers", () => {
    expect(formatWeekdayShort("2026-11-05T18:00:00Z")).toBe("tor");
    expect(formatWeekdayShort("2026-10-23T16:30:00Z")).toBe("fre");
    expect(formatWeekdayShort("2026-10-31T17:00:00Z")).toBe("lør");
    expect(formatWeekdayShort("2026-10-25T17:30:00Z")).toBe("søn");
    expect(formatWeekdayShort("nope")).toBe("");
  });
});

describe("formatCompactDate", () => {
  it("formats as '14. sep 2026' without the month's dot", () => {
    expect(formatCompactDate("2026-09-14T16:30:00Z")).toBe("14. sep 2026");
    expect(formatCompactDate("2026-05-01T16:30:00Z")).toBe("1. maj 2026");
    expect(formatCompactDate("nope")).toBe("");
  });
});

describe("formatTimeRange", () => {
  it("joins start and end with an en dash", () => {
    expect(formatTimeRange("2026-10-23T16:30:00Z", "2026-10-23T21:00:00Z")).toBe("18:30–23:00");
  });

  it("shows only the start without an end", () => {
    expect(formatTimeRange("2026-10-23T16:30:00Z")).toBe("18:30");
    expect(formatTimeRange("2026-10-23T16:30:00Z", null)).toBe("18:30");
  });

  it("handles an end after midnight and the October change (E20)", () => {
    // 24 → 25 October 2026: clocks go back at 03:00 CEST (01:00 UTC).
    expect(formatTimeRange("2026-10-24T16:30:00Z", "2026-10-24T23:00:00Z")).toBe("18:30–01:00");
    // Ends after the change, in winter time: 02:30 UTC is 03:30 CET.
    expect(formatTimeRange("2026-10-24T16:30:00Z", "2026-10-25T02:30:00Z")).toBe("18:30–03:30");
  });

  it("returns an empty string for an invalid start", () => {
    expect(formatTimeRange("nope", "2026-10-23T21:00:00Z")).toBe("");
  });
});

describe("formatRelativeDays", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(formatRelativeDays(0)).toBe("i dag");
    expect(formatRelativeDays(1)).toBe("i morgen");
    expect(formatRelativeDays(-1)).toBe("i går");
  });

  it("counts days into the future and the past", () => {
    expect(formatRelativeDays(3)).toBe("om 3 dage");
    expect(formatRelativeDays(30)).toBe("om 30 dage");
    expect(formatRelativeDays(-4)).toBe("for 4 dage siden");
  });

  it("returns an empty string for a non-number", () => {
    expect(formatRelativeDays(Number.NaN)).toBe("");
  });
});

describe("formatRelativePast", () => {
  const now = new Date("2026-10-18T10:00:00Z"); // Sunday 18 October 2026, 12:00 in Copenhagen

  it("names today and yesterday by the Copenhagen calendar day", () => {
    expect(formatRelativePast("2026-10-18T05:00:00Z", now)).toBe("i dag");
    // 23:30 Copenhagen the day before: yesterday, although only 10½ hours ago.
    expect(formatRelativePast("2026-10-17T21:30:00Z", now)).toBe("i går");
    // 00:30 Copenhagen today is 22:30 UTC the day before: still today.
    expect(formatRelativePast("2026-10-17T22:30:00Z", now)).toBe("i dag");
  });

  it("counts days up to a week", () => {
    expect(formatRelativePast("2026-10-16T10:00:00Z", now)).toBe("for 2 dage siden");
    expect(formatRelativePast("2026-10-14T10:00:00Z", now)).toBe("for 4 dage siden");
    expect(formatRelativePast("2026-10-12T10:00:00Z", now)).toBe("for 6 dage siden");
  });

  it("counts weeks until a whole calendar month has passed", () => {
    expect(formatRelativePast("2026-10-11T10:00:00Z", now)).toBe("for 1 uge siden");
    expect(formatRelativePast("2026-10-05T10:00:00Z", now)).toBe("for 1 uge siden");
    expect(formatRelativePast("2026-10-04T10:00:00Z", now)).toBe("for 2 uger siden");
    expect(formatRelativePast("2026-09-27T10:00:00Z", now)).toBe("for 3 uger siden");
    // 26 days, and 19 September → 18 October is not yet a month: weeks.
    expect(formatRelativePast("2026-09-22T10:00:00Z", now)).toBe("for 3 uger siden");
    expect(formatRelativePast("2026-09-19T10:00:00Z", now)).toBe("for 4 uger siden");
  });

  it("counts calendar months, then years", () => {
    expect(formatRelativePast("2026-09-18T10:00:00Z", now)).toBe("for 1 måned siden");
    expect(formatRelativePast("2026-08-10T10:00:00Z", now)).toBe("for 2 måneder siden");
    expect(formatRelativePast("2025-11-01T10:00:00Z", now)).toBe("for 11 måneder siden");
    expect(formatRelativePast("2025-10-18T10:00:00Z", now)).toBe("for 1 år siden");
    expect(formatRelativePast("2023-01-01T10:00:00Z", now)).toBe("for 3 år siden");
  });

  it("counts one calendar day across the autumn clock change (25-hour day)", () => {
    // 00:30 CEST on Sunday 25 October → 00:30 CET on Monday 26 October: 25 hours.
    expect(
      formatRelativePast(new Date("2026-10-24T22:30:00Z"), new Date("2026-10-25T23:30:00Z")),
    ).toBe("i går");
    // 23:30 CEST on Saturday 24 October → 00:30 CET on Monday 26 October: two days.
    expect(
      formatRelativePast(new Date("2026-10-24T21:30:00Z"), new Date("2026-10-25T23:30:00Z")),
    ).toBe("for 2 dage siden");
  });

  it("counts one calendar day across the spring clock change (23-hour day)", () => {
    // 00:30 CET on Sunday 29 March → 00:30 CEST on Monday 30 March: 23 hours.
    expect(
      formatRelativePast(new Date("2026-03-28T23:30:00Z"), new Date("2026-03-29T22:30:00Z")),
    ).toBe("i går");
  });

  it("treats a date after now as today and an invalid date as empty", () => {
    expect(formatRelativePast("2026-10-19T10:00:00Z", now)).toBe("i dag");
    expect(formatRelativePast("ikke en dato", now)).toBe("");
    expect(formatRelativePast(now, "ikke en dato")).toBe("");
  });
});
