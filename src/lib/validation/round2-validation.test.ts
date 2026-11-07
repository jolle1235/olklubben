import { describe, expect, it } from "vitest";

import { validationError } from "@/lib/action-result";

import { beerFormSchema, beerRefSchema } from "./beer";
import { END_BEFORE_START_MESSAGE, eventFormSchema } from "./event";
import { idSchema } from "./id";
import { RATING_VALUE_MESSAGE, ratingValueSchema } from "./rating";

function fieldErrors(result: { success: boolean; error?: unknown }) {
  if (result.success || !result.error) return {};
  return validationError(result.error as Parameters<typeof validationError>[0]).error.fieldErrors;
}

const EVENT_ID = "0199a000-0000-7000-8000-00000000e001";

// Round 3: the place is "＋ Nyt sted" (placeId "new" + newPlaceName), like the
// interim form; places and hosts are covered in round3-validation.test.ts.
describe("eventFormSchema (SPEC §9.2)", () => {
  const valid = {
    title: "  Ølsmagning #13 ",
    date: "2026-10-23",
    startTime: "18:30",
    endTime: "",
    placeId: "new",
    newPlaceName: " Hos Jesper ",
    theme: "",
    description: "",
  };

  it("trims texts, stores empty optional texts as null and resolves the times", () => {
    expect(eventFormSchema.parse(valid)).toEqual({
      title: "Ølsmagning #13",
      theme: null,
      description: null,
      startsAt: new Date("2026-10-23T16:30:00Z"),
      endsAt: null,
      hasStartTime: true,
      place: { kind: "new", name: "Hos Jesper", address: null, ownedByCreator: false },
      hostIds: [],
    });
  });

  it("accepts missing or null optional fields (FormData)", () => {
    const required = {
      title: valid.title,
      date: valid.date,
      startTime: valid.startTime,
      placeId: valid.placeId,
      newPlaceName: valid.newPlaceName,
    };
    expect(eventFormSchema.safeParse(required).success).toBe(true);
    expect(eventFormSchema.safeParse({ ...valid, theme: null, description: null }).success).toBe(
      true,
    );
  });

  it("keeps the description's line breaks and normalises CRLF", () => {
    const parsed = eventFormSchema.parse({
      ...valid,
      description: "  Vi starter med en tysk øl.\r\n\r\nDerefter pizza.  ",
      theme: "  Tyske   øl ",
    });
    expect(parsed.description).toBe("Vi starter med en tysk øl.\n\nDerefter pizza.");
    expect(parsed.theme).toBe("Tyske øl");
  });

  it("takes the end as an explicit day and time, also days later (D-176)", () => {
    const overnight = eventFormSchema.parse({ ...valid, endDate: "2026-10-24", endTime: "01:00" });
    expect(overnight.endsAt).toEqual(new Date("2026-10-23T23:00:00Z"));
    const weekend = eventFormSchema.parse({ ...valid, endDate: "2026-10-25", endTime: "14:00" });
    expect(weekend.endsAt).toEqual(new Date("2026-10-25T13:00:00Z"));
  });

  it("never moves an end time to the next day by itself (D-176)", () => {
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...valid, endDate: "2026-10-23", endTime: "01:00" })),
    ).toEqual({ endTime: [END_BEFORE_START_MESSAGE] });
  });

  it("wants both an end day and an end time, or neither", () => {
    expect(fieldErrors(eventFormSchema.safeParse({ ...valid, endTime: "23:00" }))).toEqual({
      endDate: ["Vælg en slutdag."],
    });
    expect(fieldErrors(eventFormSchema.safeParse({ ...valid, endDate: "2026-10-24" }))).toEqual({
      endTime: ["Vælg et sluttidspunkt."],
    });
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...valid, endDate: "2026-10-22", endTime: "23:00" })),
    ).toEqual({ endDate: [END_BEFORE_START_MESSAGE] });
  });

  it("without a start time, an end day alone makes it last several days", () => {
    const parsed = eventFormSchema.parse({ ...valid, startTime: "", endDate: "2026-10-25" });
    expect(parsed).toMatchObject({
      hasStartTime: false,
      startsAt: new Date("2026-10-22T22:00:00Z"),
      // The midnight after Sunday 25 October (winter time).
      endsAt: new Date("2026-10-25T23:00:00Z"),
    });
  });

  it("allows events in the past", () => {
    expect(eventFormSchema.safeParse({ ...valid, date: "2019-05-17" }).success).toBe(true);
  });

  it("gives Danish messages per field", () => {
    const result = eventFormSchema.safeParse({
      title: " ",
      date: "2026-02-30",
      startTime: "25:00",
      endTime: "nej",
      placeId: "new",
      newPlaceName: "",
      theme: "x".repeat(81),
      description: "x".repeat(5001),
    });
    expect(fieldErrors(result)).toEqual({
      title: ["Giv eventet en titel."],
      date: ["Datoen findes ikke. Vælg en anden dato."],
      startTime: ["Skriv tiden som tt:mm, fx 18:30."],
      endTime: ["Skriv sluttiden som tt:mm, fx 23:00."],
      newPlaceName: ["Giv stedet et navn."],
      theme: ["Temaet må højst være 80 tegn."],
      description: ["Planen må højst være 5000 tegn."],
    });
  });

  it("requires only a title and a date (D-175)", () => {
    expect(fieldErrors(eventFormSchema.safeParse({ ...valid, date: "", startTime: "" }))).toEqual({
      date: ["Vælg en dato."],
    });
    expect(fieldErrors(eventFormSchema.safeParse({}))).toEqual({
      title: ["Giv eventet en titel."],
      date: ["Vælg en dato."],
    });
  });

  it("without a start time: no end time, and the event spans the date (D-175)", () => {
    const parsed = eventFormSchema.safeParse({ ...valid, startTime: "", endTime: "" });
    expect(parsed.success && parsed.data.hasStartTime).toBe(false);
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...valid, startTime: "", endTime: "23:00" })),
    ).toEqual({ endTime: ["Vælg et starttidspunkt, før du sætter en sluttid."] });
  });

  it("enforces the length limits", () => {
    expect(fieldErrors(eventFormSchema.safeParse({ ...valid, title: "x".repeat(101) }))).toEqual({
      title: ["Titlen må højst være 100 tegn."],
    });
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...valid, newPlaceName: "x".repeat(121) })),
    ).toEqual({ newPlaceName: ["Navnet må højst være 120 tegn."] });
    expect(eventFormSchema.safeParse({ ...valid, title: "x".repeat(100) }).success).toBe(true);
  });

  // Postgres text cannot store U+0000: stripped silently, like extra whitespace.
  it("removes NUL characters from the texts", () => {
    const parsed = eventFormSchema.parse({
      ...valid,
      title: "Ølsmagning\u0000 #3",
      newPlaceName: "Hos\u0000 Jesper",
      theme: "Tyske\u0000 øl",
      description: "Først\u0000 pizza.\nSå øl.",
    });
    expect(parsed).toMatchObject({
      title: "Ølsmagning #3",
      place: { kind: "new", name: "Hos Jesper" },
      theme: "Tyske øl",
      description: "Først pizza.\nSå øl.",
    });
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...valid, title: "\u0000", newPlaceName: "\u0000" })),
    ).toEqual({ title: ["Giv eventet en titel."], newPlaceName: ["Giv stedet et navn."] });
    expect(eventFormSchema.parse({ ...valid, description: " \u0000 " }).description).toBeNull();
  });

  it("refuses an end at the start, also while other fields are invalid", () => {
    const end = { endDate: "2026-10-23", endTime: "18:30" };
    expect(fieldErrors(eventFormSchema.safeParse({ ...valid, ...end }))).toEqual({
      endTime: [END_BEFORE_START_MESSAGE],
    });
    expect(fieldErrors(eventFormSchema.safeParse({ ...valid, ...end, title: "" }))).toEqual({
      title: ["Giv eventet en titel."],
      endTime: [END_BEFORE_START_MESSAGE],
    });
  });
});

describe("beerFormSchema (SPEC §9.5)", () => {
  const valid = { name: "  Westmalle   Tripel ", abv: "9,5", eventId: "", confirmDuplicate: "" };

  it("cleans the name, parses the ABV and turns '' into null", () => {
    expect(beerFormSchema.parse(valid)).toEqual({
      name: "Westmalle Tripel",
      abv: 9.5,
      eventId: null,
      confirmDuplicate: false,
      removeImage: false,
    });
  });

  it("reads 'Fjern billede' as a flag (D-158)", () => {
    expect(beerFormSchema.parse({ ...valid, removeImage: "1" }).removeImage).toBe(true);
    expect(beerFormSchema.parse({ ...valid, removeImage: "" }).removeImage).toBe(false);
  });

  it("accepts an event id and the duplicate confirmation", () => {
    expect(
      beerFormSchema.parse({ ...valid, eventId: EVENT_ID, confirmDuplicate: "1" }),
    ).toMatchObject({ eventId: EVENT_ID, confirmDuplicate: true });
    expect(beerFormSchema.parse({ ...valid, confirmDuplicate: "on" }).confirmDuplicate).toBe(true);
    expect(beerFormSchema.parse({ name: "Ale", abv: "5" })).toMatchObject({
      eventId: null,
      confirmDuplicate: false,
    });
  });

  it("removes NUL characters from the name", () => {
    expect(beerFormSchema.parse({ ...valid, name: "Westmalle\u0000 Tripel" }).name).toBe(
      "Westmalle Tripel",
    );
    expect(fieldErrors(beerFormSchema.safeParse({ ...valid, name: "\u0000" }))).toEqual({
      name: ["Giv øllen et navn."],
    });
  });

  it("refuses an over-long ABV as a format error", () => {
    expect(
      fieldErrors(beerFormSchema.safeParse({ ...valid, abv: "5" + " ".repeat(1000) + "%" })),
    ).toEqual({
      abv: ["Skriv alkoholprocenten som et tal, fx 5,2."],
    });
  });

  it("gives Danish messages", () => {
    expect(fieldErrors(beerFormSchema.safeParse({ name: " ", abv: "", eventId: "x" }))).toEqual({
      name: ["Giv øllen et navn."],
      abv: ["Skriv alkoholprocenten, fx 5,2."],
      eventId: ["Vælg et event fra listen."],
    });
    expect(fieldErrors(beerFormSchema.safeParse({ ...valid, abv: "5,25" }))).toEqual({
      abv: ["Brug højst én decimal, fx 5,2."],
    });
    expect(fieldErrors(beerFormSchema.safeParse({ ...valid, abv: "100" }))).toEqual({
      abv: ["Alkoholprocenten skal være mellem 0 og 99,9."],
    });
    expect(fieldErrors(beerFormSchema.safeParse({ ...valid, name: "x".repeat(121) }))).toEqual({
      name: ["Navnet må højst være 120 tegn."],
    });
  });
});

describe("beerRefSchema (§4.4, E22)", () => {
  it("accepts a club id and a beer id, and refuses a malformed one", () => {
    expect(idSchema.safeParse(EVENT_ID).success).toBe(true);
    expect(beerRefSchema.safeParse({ clubId: EVENT_ID, beerId: EVENT_ID }).success).toBe(true);
    expect(beerRefSchema.safeParse({ clubId: EVENT_ID, beerId: "123" }).success).toBe(false);
    expect(beerRefSchema.safeParse({ clubId: "../x", beerId: EVENT_ID }).success).toBe(false);
    expect(beerRefSchema.safeParse({ clubId: EVENT_ID }).success).toBe(false);
  });
});

describe("ratingValueSchema (D-003)", () => {
  it("accepts integers 2..10, also as strings", () => {
    expect(ratingValueSchema.parse("9")).toBe(9);
    expect(ratingValueSchema.parse(2)).toBe(2);
    expect(ratingValueSchema.parse("10")).toBe(10);
  });

  it("refuses anything else with one Danish message", () => {
    for (const value of [1, 11, 4.5, "", "fem", null]) {
      const result = ratingValueSchema.safeParse(value);
      expect(result.success, String(value)).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(RATING_VALUE_MESSAGE);
    }
  });
});
