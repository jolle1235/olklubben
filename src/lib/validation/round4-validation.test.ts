import { describe, expect, it } from "vitest";

import { validationError } from "@/lib/action-result";
import { readFormValues } from "@/lib/form-data";

import {
  ballotMessage,
  ballotSchema,
  NOTHING_TO_VOTE_MESSAGE,
  POLL_ARRAY_FIELDS,
  pollEditSchema,
  pollFormSchema,
  pollRefSchema,
  pollTimingMessage,
  tieChoiceSchema,
  TIE_CHOICE_MESSAGES,
} from "./poll";

function fieldErrors(result: { success: boolean; error?: unknown }) {
  if (result.success || !result.error) return {};
  return validationError(result.error as Parameters<typeof validationError>[0]).error.fieldErrors;
}

const ids = (count: number, prefix = "0199a000-0000-7000-8000-") =>
  Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(12, "0")}`);
const [P1, P2] = ids(2);
const OPTION = "0199a000-0000-7000-8000-00000000b001";

const base = {
  title: "Ølsmagning #15",
  theme: "",
  description: "",
  dates: ["2026-11-14", "2026-11-21", ""],
  startTime: "18:30",
  placeIds: [P1 as string, P2 as string],
  deadlineDate: "2026-11-10",
  deadlineTime: "20:00",
};

describe("pollFormSchema (§9.7.1, D-134)", () => {
  it("parses the form into instants and places", () => {
    expect(pollFormSchema.parse(base)).toEqual({
      title: "Ølsmagning #15",
      theme: null,
      description: null,
      dateStartsAt: [new Date("2026-11-14T17:30:00.000Z"), new Date("2026-11-21T17:30:00.000Z")],
      places: { existingIds: [P1, P2], newPlace: null },
      deadline: new Date("2026-11-10T19:00:00.000Z"),
    });
  });

  it("reads repeated fields from FormData (POLL_ARRAY_FIELDS) and sorts the dates", () => {
    const form = new FormData();
    form.set("title", "Plan");
    for (const date of ["2026-11-21", "2026-11-14"]) form.append("dates", date);
    form.set("startTime", "18:30");
    form.append("placeIds", P1 as string);
    form.set("deadlineDate", "2026-11-10");
    form.set("deadlineTime", "20:00");
    const parsed = pollFormSchema.parse(readFormValues(form, { arrays: POLL_ARRAY_FIELDS }));
    expect(parsed.dateStartsAt.map((d) => d.toISOString())).toEqual([
      "2026-11-14T17:30:00.000Z",
      "2026-11-21T17:30:00.000Z",
    ]);
    expect(parsed.places.existingIds).toEqual([P1]);
  });

  it("strips NUL, trims and keeps line breaks in the description", () => {
    const parsed = pollFormSchema.parse({
      ...base,
      title: " Øl\u0000smagning ",
      theme: "  Jule\u0000øl  ",
      description: "Linje 1\r\nLinje 2",
    });
    expect(parsed.title).toBe("Ølsmagning");
    expect(parsed.theme).toBe("Juleøl");
    expect(parsed.description).toBe("Linje 1\nLinje 2");
  });

  it("gives every title, theme and description message once", () => {
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, title: "  " }))).toEqual({
      title: ["Giv afstemningen en titel."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, title: "x".repeat(101) }))).toEqual({
      title: ["Titlen må højst være 100 tegn."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, theme: "x".repeat(81) }))).toEqual({
      theme: ["Temaet må højst være 80 tegn."],
    });
    expect(
      fieldErrors(pollFormSchema.safeParse({ ...base, description: "x".repeat(5001) })),
    ).toEqual({ description: ["Beskrivelsen må højst være 5000 tegn."] });
  });

  it("refuses a 100 000-character title before cleaning it", () => {
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, title: " ".repeat(100_000) }))).toEqual({
      title: ["Titlen må højst være 100 tegn."],
    });
  });

  it("drops empty date rows and gives one message per date problem", () => {
    const errors = (dates: unknown) => fieldErrors(pollFormSchema.safeParse({ ...base, dates }));
    expect(errors(["", " "])).toEqual({ dates: ["Tilføj mindst én dato."] });
    expect(errors(undefined)).toEqual({ dates: ["Tilføj mindst én dato."] });
    expect(errors(["2026-11-14", "2026-02-30"])).toEqual({
      dates: ["Datoen findes ikke. Vælg en anden dato."],
    });
    expect(errors(["2026-11-14", "2026-11-14"])).toEqual({
      dates: ["Du har valgt samme dato to gange."],
    });
    const eleven = Array.from(
      { length: 11 },
      (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`,
    );
    expect(errors(eleven)).toEqual({ dates: ["Der kan højst være 10 datoer."] });
    expect(errors(["2026-11-14", "x".repeat(21)])).toEqual({
      dates: ["Datoen findes ikke. Vælg en anden dato."],
    });
    expect(errors(Array.from({ length: 60 }, () => ""))).toEqual({
      dates: ["Der kan højst være 10 datoer."],
    });
  });

  it("checks the start time and the deadline fields", () => {
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, startTime: "" }))).toEqual({
      startTime: ["Vælg et starttidspunkt."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, startTime: "25:00" }))).toEqual({
      startTime: ["Skriv tiden som tt:mm, fx 18:30."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, deadlineDate: "" }))).toEqual({
      deadlineDate: ["Vælg en dato for fristen."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, deadlineDate: "2026-13-01" }))).toEqual({
      deadlineDate: ["Datoen findes ikke. Vælg en anden dato."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, deadlineTime: "" }))).toEqual({
      deadlineTime: ["Vælg et tidspunkt for fristen."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, deadlineTime: "kl 8" }))).toEqual({
      deadlineTime: ["Skriv tiden som tt:mm, fx 20:00."],
    });
  });

  it("refuses a deadline at or after the first date", () => {
    expect(
      fieldErrors(
        pollFormSchema.safeParse({ ...base, deadlineDate: "2026-11-14", deadlineTime: "18:30" }),
      ),
    ).toEqual({
      deadlineDate: ["Fristen skal ligge før den første dato (lørdag 14. november kl. 18:30)."],
    });
    expect(
      pollFormSchema.safeParse({ ...base, deadlineDate: "2026-11-14", deadlineTime: "18:29" })
        .success,
    ).toBe(true);
  });

  it("needs a place, at most 10, and something to vote on", () => {
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, placeIds: [] }))).toEqual({
      placeIds: ["Vælg mindst ét sted, eller opret et nyt."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, placeIds: ["nej"] }))).toEqual({
      placeIds: ["Vælg steder fra listen."],
    });
    expect(fieldErrors(pollFormSchema.safeParse({ ...base, placeIds: ids(11) }))).toEqual({
      placeIds: ["Der kan højst være 10 steder."],
    });
    expect(
      fieldErrors(
        pollFormSchema.safeParse({
          ...base,
          placeIds: ids(10),
          newPlace: "on",
          newPlaceName: "Ny",
        }),
      ),
    ).toEqual({ placeIds: ["Der kan højst være 10 steder."] });
    // One date + one place: nothing to vote on (C16).
    expect(
      fieldErrors(pollFormSchema.safeParse({ ...base, dates: ["2026-11-14"], placeIds: [P1] })),
    ).toEqual({ dates: [NOTHING_TO_VOTE_MESSAGE] });
    // One date + two places, or two dates + one place, is fine.
    expect(pollFormSchema.safeParse({ ...base, dates: ["2026-11-14"] }).success).toBe(true);
    expect(pollFormSchema.safeParse({ ...base, placeIds: [P1] }).success).toBe(true);
  });

  it("uses the new place only when «＋ Nyt sted» is ticked", () => {
    const ignored = pollFormSchema.parse({ ...base, newPlaceName: "Hos Bo", newPlaceMine: "on" });
    expect(ignored.places.newPlace).toBeNull();

    const parsed = pollFormSchema.parse({
      ...base,
      placeIds: [P1],
      newPlace: "on",
      newPlaceName: "  Hos   Bo ",
      newPlaceAddress: " Vej 1 ",
      newPlaceMine: "on",
    });
    expect(parsed.places).toEqual({
      existingIds: [P1],
      newPlace: { name: "Hos Bo", address: "Vej 1", ownedByCreator: true },
    });
    // Only "＋ Nyt sted" counts as a place.
    expect(
      pollFormSchema.parse({ ...base, placeIds: [], newPlace: "on", newPlaceName: "Hos Bo" })
        .places,
    ).toEqual({
      existingIds: [],
      newPlace: { name: "Hos Bo", address: null, ownedByCreator: false },
    });

    expect(
      fieldErrors(pollFormSchema.safeParse({ ...base, newPlace: "on", newPlaceName: " " })),
    ).toEqual({ newPlaceName: ["Giv stedet et navn."] });
    expect(
      fieldErrors(
        pollFormSchema.safeParse({ ...base, newPlace: "on", newPlaceName: "x".repeat(121) }),
      ),
    ).toEqual({ newPlaceName: ["Navnet må højst være 120 tegn."] });
  });

  it("runs the object-level checks while other fields are invalid (F-037), without duplicates (F-056)", () => {
    const errors = fieldErrors(
      pollFormSchema.safeParse({
        ...base,
        title: "",
        placeIds: [],
        deadlineDate: "2026-11-30",
        newPlace: "on",
        newPlaceName: "",
      }),
    );
    expect(errors).toEqual({
      title: ["Giv afstemningen en titel."],
      newPlaceName: ["Giv stedet et navn."],
      deadlineDate: ["Fristen skal ligge før den første dato (lørdag 14. november kl. 18:30)."],
    });
    for (const messages of Object.values(errors ?? {})) {
      expect(new Set(messages).size).toBe(messages.length);
    }
  });
});

describe("pollEditSchema (D-133)", () => {
  it("parses texts and the deadline", () => {
    expect(
      pollEditSchema.parse({
        title: "Ny titel",
        theme: "",
        description: null,
        deadlineDate: "2026-11-12",
        deadlineTime: "21:00",
      }),
    ).toEqual({
      title: "Ny titel",
      theme: null,
      description: null,
      deadline: new Date("2026-11-12T20:00:00.000Z"),
    });
  });

  it("gives the field messages", () => {
    expect(
      fieldErrors(pollEditSchema.safeParse({ title: "", deadlineDate: "", deadlineTime: "" })),
    ).toEqual({
      title: ["Giv afstemningen en titel."],
      deadlineDate: ["Vælg en dato for fristen."],
      deadlineTime: ["Vælg et tidspunkt for fristen."],
    });
  });
});

describe("ballotSchema (§9.7.2)", () => {
  it("parses dates, «Ingen passer» and the place", () => {
    expect(
      ballotSchema.parse({ dateOptionIds: [OPTION, OPTION], placeOptionId: ` ${P1} ` }),
    ).toEqual({
      dateOptionIds: [OPTION],
      noDateWorks: false,
      placeOptionId: P1,
    });
    expect(ballotSchema.parse({ noDateWorks: "on", placeOptionId: "" })).toEqual({
      dateOptionIds: [],
      noDateWorks: true,
      placeOptionId: null,
    });
  });

  it("refuses dates together with «Ingen passer», and bad ids", () => {
    expect(
      fieldErrors(ballotSchema.safeParse({ dateOptionIds: [OPTION], noDateWorks: "on" })),
    ).toEqual({ dateOptionIds: ["Vælg enten datoer eller «Ingen af datoerne passer mig»."] });
    expect(fieldErrors(ballotSchema.safeParse({ dateOptionIds: ["nej"] }))).toEqual({
      dateOptionIds: ["Vælg datoer fra listen."],
    });
    expect(fieldErrors(ballotSchema.safeParse({ dateOptionIds: ids(11) }))).toEqual({
      dateOptionIds: ["Vælg højst 10 datoer."],
    });
    expect(fieldErrors(ballotSchema.safeParse({ placeOptionId: "nej" }))).toEqual({
      placeOptionId: ["Vælg et sted fra listen."],
    });
    expect(fieldErrors(ballotSchema.safeParse({ placeOptionId: "x".repeat(65) }))).toEqual({
      placeOptionId: ["Vælg et sted fra listen."],
    });
  });

  it("maps castBallot's codes to fields", () => {
    expect(ballotMessage("DATE_REQUIRED")).toEqual({
      field: "dateOptionIds",
      message: "Sæt kryds ved mindst én dato, eller vælg «Ingen af datoerne passer mig».",
    });
    expect(ballotMessage("DATE_AND_NONE").field).toBe("dateOptionIds");
    expect(ballotMessage("PLACE_REQUIRED")).toEqual({
      field: "placeOptionId",
      message: "Vælg et sted.",
    });
    expect(ballotMessage("UNKNOWN_OPTION")).toEqual({
      field: null,
      message: "Afstemningen er ændret. Genindlæs siden.",
    });
  });
});

describe("tieChoiceSchema (D-008)", () => {
  it("returns the chosen option per category", () => {
    expect(tieChoiceSchema.parse({ placeOptionId: P1 })).toEqual({ PLACE: P1 });
    expect(tieChoiceSchema.parse({ dateOptionId: OPTION, placeOptionId: "" })).toEqual({
      DATE: OPTION,
    });
    expect(tieChoiceSchema.parse({})).toEqual({});
  });

  it("refuses malformed ids with the category's message", () => {
    expect(
      fieldErrors(tieChoiceSchema.safeParse({ dateOptionId: "nej", placeOptionId: "nej" })),
    ).toEqual({
      dateOptionId: [TIE_CHOICE_MESSAGES.DATE],
      placeOptionId: [TIE_CHOICE_MESSAGES.PLACE],
    });
  });
});

describe("pollTimingMessage and pollRefSchema", () => {
  const first = new Date("2026-11-14T17:30:00.000Z");
  const previous = new Date("2026-11-10T19:00:00.000Z");

  it("maps every timing error to a field and a Danish message", () => {
    expect(pollTimingMessage("DATE_PAST")).toEqual({
      field: "dates",
      message: "Datoerne skal ligge i fremtiden.",
    });
    expect(pollTimingMessage("DEADLINE_PAST")).toEqual({
      field: "deadlineDate",
      message: "Fristen skal ligge i fremtiden.",
    });
    expect(pollTimingMessage("DEADLINE_NOT_BEFORE_FIRST_DATE", { firstDate: first })).toEqual({
      field: "deadlineDate",
      message: "Fristen skal ligge før den første dato (lørdag 14. november kl. 18:30).",
    });
    expect(pollTimingMessage("DEADLINE_SHORTENED", { previousDeadline: previous })).toEqual({
      field: "deadlineDate",
      message: "Fristen kan kun rykkes senere (nu: tirsdag 10. november kl. 20:00).",
    });
  });

  it("pollRefSchema refuses malformed ids", () => {
    expect(pollRefSchema.safeParse({ clubId: P1, pollId: P2 }).success).toBe(true);
    expect(pollRefSchema.safeParse({ clubId: P1, pollId: "123" }).success).toBe(false);
  });
});
