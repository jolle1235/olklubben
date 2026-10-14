import { describe, expect, it } from "vitest";

import { zonedDateTimeToUtc } from "@/server/domain/events/time";

import {
  addDateRow,
  canAddDateRow,
  canRemoveDateRow,
  changeDateRow,
  dateRowLabel,
  datesHint,
  deadlineInstant,
  followDeadline,
  initialDateRows,
  initialDeadline,
  initialPlaceSelection,
  placeCount,
  pollSummary,
  removeDateLabel,
  removeDateRow,
  shapeHint,
  togglePlace,
  validDates,
  type DateRow,
} from "./poll-form-state";

const TODAY = "2026-10-14";
const rows = (...dates: string[]): DateRow[] => dates.map((date, i) => ({ key: `k${i}`, date }));

describe("date rows", () => {
  it("start from the echo (blank rows kept), else the suggestions, else today + 7", () => {
    expect(
      initialDateRows({ echoed: ["2026-11-07", ""], suggested: ["2026-11-14"], today: TODAY }).map(
        (r) => r.date,
      ),
    ).toEqual(["2026-11-07", ""]);
    expect(
      initialDateRows({ echoed: [], suggested: ["2026-11-14", "2026-11-21"], today: TODAY }).map(
        (r) => r.date,
      ),
    ).toEqual(["2026-11-14", "2026-11-21"]);
    expect(initialDateRows({ suggested: [], today: TODAY }).map((r) => r.date)).toEqual([
      "2026-10-21",
    ]);
  });

  it("have unique, stable keys", () => {
    const initial = initialDateRows({
      suggested: ["2026-11-14", "2026-11-21", "2026-11-28"],
      today: TODAY,
    });
    expect(new Set(initial.map((r) => r.key)).size).toBe(3);
  });

  it("add one week after the latest valid date", () => {
    expect(addDateRow(rows("2026-11-14", "2026-11-28", "2026-11-21"), TODAY, "new").at(-1)).toEqual(
      { key: "new", date: "2026-12-05" },
    );
    expect(addDateRow(rows("", "nope"), TODAY, "new").at(-1)?.date).toBe("2026-10-21");
  });

  it("add across the October DST change by calendar days", () => {
    expect(addDateRow(rows("2026-10-24"), TODAY, "n").at(-1)?.date).toBe("2026-10-31");
  });

  it("stop at 10 rows", () => {
    const ten = rows(...Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 10)}`));
    expect(canAddDateRow(ten)).toBe(false);
    expect(addDateRow(ten, TODAY, "x")).toHaveLength(10);
    expect(canAddDateRow(ten.slice(0, 9))).toBe(true);
  });

  it("never remove the last row", () => {
    expect(canRemoveDateRow(rows("2026-11-14"))).toBe(false);
    expect(removeDateRow(rows("2026-11-14"), "k0")).toHaveLength(1);
    expect(removeDateRow(rows("2026-11-14", "2026-11-21"), "k0").map((r) => r.date)).toEqual([
      "2026-11-21",
    ]);
  });

  it("change one row by key", () => {
    expect(
      changeDateRow(rows("2026-11-14", "2026-11-21"), "k1", "2026-12-01").map((r) => r.date),
    ).toEqual(["2026-11-14", "2026-12-01"]);
  });

  it("valid dates are sorted, trimmed and deduplicated", () => {
    expect(validDates(rows("2026-11-21", "", "2026-11-14", "2026-11-21", "2026-02-30"))).toEqual([
      "2026-11-14",
      "2026-11-21",
    ]);
  });

  it("labels: weekday beside the row and the ✕ button's name", () => {
    expect(dateRowLabel("2026-11-14")).toBe("lørdag 14. november");
    expect(dateRowLabel("")).toBe("");
    expect(removeDateLabel(1, "2026-11-21")).toBe("Fjern dato 2 (lørdag 21. november)");
    expect(removeDateLabel(0, "")).toBe("Fjern dato 1");
  });

  it("hint names the suggested weekday", () => {
    expect(datesHint(["2026-11-14", "2026-11-21", "2026-11-28"])).toBe(
      "Forslag: de næste tre lørdage. Ret dem, som det passer.",
    );
    expect(datesHint(["2026-11-12", "2026-11-19", "2026-11-26"])).toBe(
      "Forslag: de næste tre torsdage. Ret dem, som det passer.",
    );
    expect(datesHint([])).toBe("Tilføj de datoer, klubben kan vælge imellem.");
  });
});

describe("places", () => {
  it("start: none → ＋ Nyt sted; one → ticked; more → nothing", () => {
    expect(initialPlaceSelection({ placeIds: [] })).toEqual({ placeIds: [], newPlace: true });
    expect(initialPlaceSelection({ placeIds: ["a"] })).toEqual({
      placeIds: ["a"],
      newPlace: false,
    });
    expect(initialPlaceSelection({ placeIds: ["a", "b"] })).toEqual({
      placeIds: [],
      newPlace: false,
    });
  });

  it("the echo wins, limited to places still offered", () => {
    expect(
      initialPlaceSelection({
        placeIds: ["a", "b"],
        echo: { placeIds: ["b", "gone"], newPlace: "on" },
      }),
    ).toEqual({ placeIds: ["b"], newPlace: true });
    expect(initialPlaceSelection({ placeIds: ["a"], echo: { placeIds: [] } })).toEqual({
      placeIds: [],
      newPlace: false,
    });
  });

  it("toggle and count", () => {
    expect(togglePlace(["a"], "b", true)).toEqual(["a", "b"]);
    expect(togglePlace(["a", "b"], "a", false)).toEqual(["b"]);
    expect(togglePlace(["a"], "a", true)).toEqual(["a"]);
    expect(placeCount({ placeIds: ["a", "b"], newPlace: true })).toBe(3);
  });
});

describe("deadline", () => {
  const now = new Date("2026-10-14T10:00:00Z");

  it("starts from the echo (touched) or the suggestion (untouched)", () => {
    expect(
      initialDeadline({ echoed: { date: "2026-11-01", time: "21:00" }, suggested: null }),
    ).toEqual({ value: { date: "2026-11-01", time: "21:00" }, touched: true });
    expect(
      initialDeadline({ echoed: {}, suggested: { date: "2026-11-12", time: "20:00" } }),
    ).toEqual({ value: { date: "2026-11-12", time: "20:00" }, touched: false });
    expect(initialDeadline({ suggested: null })).toEqual({
      value: { date: "", time: "20:00" },
      touched: false,
    });
  });

  it("follows the first date until touched", () => {
    const current = { date: "2026-11-12", time: "20:00" };
    expect(
      followDeadline({
        current,
        touched: false,
        rows: rows("2026-11-28", "2026-11-21"),
        startTime: "18:30",
        now,
      }),
    ).toEqual({ date: "2026-11-19", time: "20:00" });
    expect(
      followDeadline({ current, touched: true, rows: rows("2026-11-21"), startTime: "18:30", now }),
    ).toBe(current);
  });

  it("is kept when nothing fits or there is no valid date", () => {
    const current = { date: "2026-11-12", time: "20:00" };
    expect(
      followDeadline({ current, touched: false, rows: rows(""), startTime: "18:30", now }),
    ).toBe(current);
    expect(
      followDeadline({ current, touched: false, rows: rows("2026-11-21"), startTime: "", now }),
    ).toBe(current);
    // The date is today: no candidate in (now + 1 h, start).
    expect(
      followDeadline({
        current,
        touched: false,
        rows: rows("2026-10-14"),
        startTime: "11:30",
        now,
      }),
    ).toBe(current);
  });

  it("converts to an instant only when complete (Copenhagen wall clock)", () => {
    expect(deadlineInstant({ date: "2026-11-12", time: "20:00" })).toEqual(
      zonedDateTimeToUtc("2026-11-12", "20:00"),
    );
    expect(deadlineInstant({ date: "", time: "20:00" })).toBeNull();
    expect(deadlineInstant({ date: "2026-11-12", time: "25:00" })).toBeNull();
  });
});

describe("live hints", () => {
  it("fixed categories and nothing to vote on", () => {
    expect(shapeHint(1, 3)).toBe("date-fixed");
    expect(shapeHint(3, 1)).toBe("place-fixed");
    expect(shapeHint(1, 1)).toBe("nothing-to-vote");
    expect(shapeHint(2, 2)).toBeNull();
    expect(shapeHint(0, 2)).toBeNull();
    expect(shapeHint(2, 0)).toBeNull();
  });

  it("summary above the button", () => {
    const deadline = zonedDateTimeToUtc("2026-11-12", "20:00");
    expect(pollSummary({ dateCount: 3, placeCount: 2, deadline })).toBe(
      "Klubben stemmer om 3 datoer og 2 steder · frist torsdag 12. november kl. 20:00.",
    );
    expect(pollSummary({ dateCount: 1, placeCount: 2, deadline: null })).toBe(
      "Klubben stemmer om 2 steder.",
    );
    expect(pollSummary({ dateCount: 2, placeCount: 1, deadline: null })).toBe(
      "Klubben stemmer om 2 datoer.",
    );
    expect(pollSummary({ dateCount: 1, placeCount: 1, deadline })).toBeNull();
    expect(pollSummary({ dateCount: 0, placeCount: 3, deadline })).toBeNull();
  });
});
