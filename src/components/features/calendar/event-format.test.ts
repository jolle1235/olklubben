import { describe, expect, it } from "vitest";

import {
  calendarItems,
  capitalize,
  countItems,
  dateKeyLabel,
  dayButtonLabel,
  eventCountLabel,
  eventPlaceAndTime,
  eventTimeText,
  eventWeekdayAndTime,
  itemCountLabel,
  pollDateAccessibleName,
  pollDateCountLabel,
  pollDateMeta,
  pollDateTitle,
  type CalendarEvent,
  type CalendarPollDate,
} from "./event-format";

const NOW = new Date("2026-10-08T10:00:00Z");

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Ølsmagning #14",
    theme: null,
    place: { name: "Hos Mads" },
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

  it("adds the possible poll dates (round 4)", () => {
    expect(dayButtonLabel("2026-10-23", 1, NOW, 1)).toBe(
      "fredag 23. oktober, 1 event, 1 mulig dato",
    );
    expect(dayButtonLabel("2026-10-23", 0, NOW, 2)).toBe(
      "fredag 23. oktober, ingen events, 2 mulige datoer",
    );
    expect(dayButtonLabel("2026-10-23", 1, NOW, 0)).toBe("fredag 23. oktober, 1 event");
  });
});

function pollDate(overrides: Partial<CalendarPollDate> = {}): CalendarPollDate {
  return {
    optionId: "o1",
    pollId: "p1",
    pollTitle: "Ølsmagning #15",
    // Saturday 14 November 2026, 18:30 Copenhagen (winter time).
    startsAt: new Date("2026-11-14T17:30:00Z"),
    // Tuesday 10 November 2026, 20:00 Copenhagen.
    deadline: new Date("2026-11-10T19:00:00Z"),
    status: "OPEN",
    viewerTicked: false,
    ...overrides,
  };
}

describe("calendarItems (CalendarItem union)", () => {
  it("merges events and poll dates by start, an event first on the same instant", () => {
    const early = event({ id: "e-early", startsAt: new Date("2026-10-20T16:30:00Z") });
    const same = event({ id: "e-same", startsAt: new Date("2026-11-14T17:30:00Z") });
    const items = calendarItems([same, early], [pollDate()]);
    expect(items.map((item) => item.key)).toEqual(["event-e-early", "event-e-same", "poll-o1"]);
    expect(items[2]).toMatchObject({ kind: "poll", option: { pollId: "p1" } });
  });

  it("works without poll dates (the round-3 callers)", () => {
    expect(calendarItems([event()]).map((item) => item.kind)).toEqual(["event"]);
  });

  it("counts both kinds", () => {
    const items = calendarItems([event()], [pollDate(), pollDate({ optionId: "o2" })]);
    expect(countItems(items)).toEqual({ events: 1, polls: 2 });
    expect(itemCountLabel(countItems(items))).toBe("1 event, 2 mulige datoer");
    expect(itemCountLabel({ events: 0, polls: 1 })).toBe("1 mulig dato");
    expect(itemCountLabel({ events: 0, polls: 0 })).toBe("ingen events");
    expect(itemCountLabel({ events: 2, polls: 0 })).toBe("2 events");
    expect(pollDateCountLabel(1)).toBe("1 mulig dato");
  });
});

describe("poll date texts (SPEC §9.3)", () => {
  it("title and meta", () => {
    expect(pollDateTitle(pollDate())).toBe("Ølsmagning #15 (afstemning)");
    expect(pollDateMeta(pollDate())).toBe("Mulig dato · stem inden 10/11");
    expect(pollDateMeta(pollDate({ status: "AWAITING_DECISION" }))).toBe(
      "Mulig dato · venter på afgørelse",
    );
  });

  it("the month chip's accessible name", () => {
    expect(pollDateAccessibleName(pollDate(), NOW)).toBe(
      "Mulig dato: Ølsmagning #15, lørdag 14. november kl. 18:30, afstemning, stem inden tirsdag 10. november",
    );
    expect(pollDateAccessibleName(pollDate({ status: "AWAITING_DECISION" }), NOW)).toBe(
      "Mulig dato: Ølsmagning #15, lørdag 14. november kl. 18:30, afstemning, venter på afgørelse",
    );
  });
});
