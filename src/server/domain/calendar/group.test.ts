import { describe, expect, it } from "vitest";

import { groupEventsByDayKey, groupEventsByMonth } from "./group";

const event = (id: string, startsAt: string) => ({ id, startsAt: new Date(startsAt) });

const events = [
  event("nov", "2026-11-14T18:00:00Z"),
  event("oct-late", "2026-10-23T18:00:00Z"),
  // 22:30 UTC on 24 October is 00:30 on 25 October in Copenhagen.
  event("after-midnight", "2026-10-24T22:30:00Z"),
  event("oct-early", "2026-10-23T16:30:00Z"),
  // 23:30 UTC on 31 October is 1 November in Copenhagen (winter time).
  event("halloween-night", "2026-10-31T23:30:00Z"),
];

describe("groupEventsByDayKey", () => {
  it("groups by Copenhagen day and sorts each day by start", () => {
    const groups = groupEventsByDayKey(events);
    expect(Object.keys(groups).sort()).toEqual([
      "2026-10-23",
      "2026-10-25",
      "2026-11-01",
      "2026-11-14",
    ]);
    expect(groups["2026-10-23"]?.map((e) => e.id)).toEqual(["oct-early", "oct-late"]);
    expect(groups["2026-10-25"]?.map((e) => e.id)).toEqual(["after-midnight"]);
    expect(groups["2026-11-01"]?.map((e) => e.id)).toEqual(["halloween-night"]);
  });

  it("returns an empty object for no events and keeps the input untouched", () => {
    expect(groupEventsByDayKey([])).toEqual({});
    const copy = [...events];
    groupEventsByDayKey(events);
    expect(events).toEqual(copy);
  });
});

describe("groupEventsByMonth", () => {
  it("groups by Copenhagen month, oldest first", () => {
    const groups = groupEventsByMonth(events);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-10", "2026-11"]);
    expect(groups[0]?.events.map((e) => e.id)).toEqual(["oct-early", "oct-late", "after-midnight"]);
    expect(groups[1]?.events.map((e) => e.id)).toEqual(["halloween-night", "nov"]);
  });

  it("can list newest first (history)", () => {
    const groups = groupEventsByMonth(events, "desc");
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-11", "2026-10"]);
    expect(groups[0]?.events.map((e) => e.id)).toEqual(["nov", "halloween-night"]);
  });

  it("keeps ties in input order", () => {
    const tie = [event("a", "2026-10-23T16:30:00Z"), event("b", "2026-10-23T16:30:00Z")];
    expect(groupEventsByMonth(tie)[0]?.events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
