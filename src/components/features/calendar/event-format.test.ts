import { describe, expect, it } from "vitest";

import {
  capitalize,
  dateKeyLabel,
  dayButtonLabel,
  eventCountLabel,
  eventPlaceAndTime,
  eventTimeText,
  eventWeekdayAndTime,
  type CalendarEvent,
} from "./event-format";

const NOW = new Date("2026-10-08T10:00:00Z");

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Ølsmagning #14",
    theme: null,
    locationText: "Hos Mads",
    // Friday 23 October 2026, 18:30 Copenhagen (summer time).
    startsAt: new Date("2026-10-23T16:30:00Z"),
    endsAt: null,
    ...overrides,
  };
}

describe("capitalize", () => {
  it("upper-cases the first letter only", () => {
    expect(capitalize("fredag")).toBe("Fredag");
    expect(capitalize("ølsmagning i aften")).toBe("Ølsmagning i aften");
    expect(capitalize("")).toBe("");
  });
});

describe("event texts", () => {
  it("shows the time, with an end when there is one", () => {
    expect(eventTimeText(event())).toBe("18:30");
    expect(eventTimeText(event({ endsAt: new Date("2026-10-23T21:30:00Z") }))).toBe("18:30–23:30");
  });

  it("place · time for the calendar list (SPEC §9.3)", () => {
    expect(eventPlaceAndTime(event())).toBe("Hos Mads · 18:30");
  });

  it("weekday · time for the hero card (SPEC §9.1)", () => {
    expect(eventWeekdayAndTime(event())).toBe("Fredag · 18:30");
    // Winter time: 19:00 on Thursday 5 November is 18:00 UTC.
    expect(
      eventWeekdayAndTime(
        event({
          startsAt: new Date("2026-11-05T18:00:00Z"),
          endsAt: new Date("2026-11-05T22:00:00Z"),
        }),
      ),
    ).toBe("Torsdag · 19:00–23:00");
  });
});

describe("eventCountLabel", () => {
  it("counts in Danish", () => {
    expect(eventCountLabel(0)).toBe("ingen events");
    expect(eventCountLabel(1)).toBe("1 event");
    expect(eventCountLabel(2)).toBe("2 events");
  });
});

describe("dateKeyLabel / dayButtonLabel", () => {
  it("names the day, with the year only outside the current year", () => {
    expect(dateKeyLabel("2026-10-23", NOW)).toBe("fredag 23. oktober");
    expect(dateKeyLabel("2027-01-05", NOW)).toBe("tirsdag 5. januar 2027");
  });

  it("keeps the date on clock-change days", () => {
    expect(dateKeyLabel("2026-10-25", NOW)).toBe("søndag 25. oktober");
    expect(dateKeyLabel("2026-03-29", NOW)).toBe("søndag 29. marts");
  });

  it("labels the mobile day buttons", () => {
    expect(dayButtonLabel("2026-10-23", 1, NOW)).toBe("fredag 23. oktober, 1 event");
    expect(dayButtonLabel("2026-10-24", 0, NOW)).toBe("lørdag 24. oktober, ingen events");
  });

  it("is empty for an invalid key", () => {
    expect(dateKeyLabel("nope", NOW)).toBe("");
  });
});
