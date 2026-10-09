import { describe, expect, it } from "vitest";

import { validationError } from "@/lib/action-result";
import { readFormValues } from "@/lib/form-data";

import {
  CLUB_DESCRIPTION_MAX_LENGTH,
  deleteClubSchema,
  memberRefSchema,
  setMemberRoleSchema,
  updateClubInfoSchema,
} from "./club";
import { EVENT_ARRAY_FIELDS, EVENT_PLACE_NEW, eventFormSchema } from "./event";
import {
  createPlaceSchema,
  ownPlaceOwnershipSchema,
  placeFieldsSchema,
  placeOwnerRefSchema,
  placeRefSchema,
} from "./place";
import { changePasswordSchema, NICKNAME_MAX_LENGTH, updateProfileSchema } from "./profile";
import { checkboxSchema, idListSchema, optionalText, rawTextLimit } from "./text";

function fieldErrors(result: { success: boolean; error?: unknown }) {
  if (result.success || !result.error) return {};
  return validationError(result.error as Parameters<typeof validationError>[0]).error.fieldErrors;
}

const PLACE_ID = "0199a000-0000-7000-8000-00000000f001";
const CLUB_ID = "0199a000-0000-7000-8000-00000000c001";
const ids = (count: number) =>
  Array.from(
    { length: count },
    (_, i) => `0199a000-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
  );

describe("text helpers (D-090)", () => {
  it("checkboxSchema: on/true/1 → true, anything else → false", () => {
    for (const value of ["on", "true", "1", true]) expect(checkboxSchema.parse(value)).toBe(true);
    for (const value of ["", "off", "0", "false", false, null, undefined]) {
      expect(checkboxSchema.parse(value)).toBe(false);
    }
  });

  it("idListSchema: missing → [], a single value → [value], deduplicated", () => {
    const schema = idListSchema(3, { tooMany: "for mange", invalid: "ugyldig" });
    const [a, b] = ids(2);
    expect(schema.parse(undefined)).toEqual([]);
    expect(schema.parse(null)).toEqual([]);
    expect(schema.parse(a)).toEqual([a]);
    expect(schema.parse([a, b, a])).toEqual([a, b]);
  });

  it("idListSchema: exactly one message on the field itself; max before dedupe", () => {
    const schema = idListSchema(3, { tooMany: "for mange", invalid: "ugyldig" });
    expect(fieldErrors(schema.safeParse(["nej"]))).toEqual({ _form: ["ugyldig"] });
    expect(fieldErrors(schema.safeParse(["x".repeat(65), "y".repeat(70)]))).toEqual({
      _form: ["ugyldig"],
    });
    expect(fieldErrors(schema.safeParse(ids(4)))).toEqual({ _form: ["for mange"] });
    expect(fieldErrors(schema.safeParse(["nej", "nej", "nej", "nej"]))).toEqual({
      _form: ["for mange"],
    });
  });

  it("optionalText: caps the raw text before cleaning it", () => {
    const schema = optionalText(10, "for lang");
    expect(schema.parse(`  ${"a".repeat(10)}   `)).toBe("a".repeat(10));
    expect(schema.parse(" ")).toBeNull();
    expect(schema.safeParse(" ".repeat(rawTextLimit(10) + 1)).success).toBe(false);
  });
});

describe("eventFormSchema: place and hosts (SPEC §9.2, D-098, D-099)", () => {
  const base = {
    title: "Ølsmagning #14",
    date: "2026-10-23",
    startTime: "18:30",
  };

  it("requires a place", () => {
    expect(fieldErrors(eventFormSchema.safeParse(base))).toEqual({
      placeId: ["Vælg et sted, eller opret et nyt."],
    });
    expect(fieldErrors(eventFormSchema.safeParse({ ...base, placeId: "  " }))).toEqual({
      placeId: ["Vælg et sted, eller opret et nyt."],
    });
  });

  it("refuses a garbage placeId with one message", () => {
    for (const placeId of ["nyt", "123", "x".repeat(65), `${PLACE_ID}x`]) {
      expect(fieldErrors(eventFormSchema.safeParse({ ...base, placeId }))).toEqual({
        placeId: ["Vælg et sted fra listen."],
      });
    }
  });

  it("chooses an existing place and ignores the new-place fields", () => {
    const parsed = eventFormSchema.parse({
      ...base,
      placeId: ` ${PLACE_ID} `,
      newPlaceName: "x".repeat(500),
      newPlaceAddress: "y".repeat(300),
      newPlaceMine: "on",
    });
    expect(parsed.place).toEqual({ kind: "existing", placeId: PLACE_ID });
  });

  it("creates a new place from the inline fields", () => {
    const parsed = eventFormSchema.parse({
      ...base,
      placeId: EVENT_PLACE_NEW,
      newPlaceName: "  Hos\u00a0 Mads ",
      newPlaceAddress: " Søndergade 12,  8381 Tilst ",
      newPlaceMine: "on",
    });
    expect(parsed.place).toEqual({
      kind: "new",
      name: "Hos Mads",
      address: "Søndergade 12, 8381 Tilst",
      ownedByCreator: true,
    });
  });

  it("requires the new place's name, also while the title is empty (F-037)", () => {
    expect(
      fieldErrors(
        eventFormSchema.safeParse({ ...base, title: "", placeId: "new", newPlaceName: " " }),
      ),
    ).toEqual({
      title: ["Giv eventet en titel."],
      newPlaceName: ["Skriv, hvor I mødes."],
    });
  });

  it("limits the new place's name to 120 and its address to 200 characters", () => {
    expect(
      fieldErrors(
        eventFormSchema.safeParse({
          ...base,
          placeId: "new",
          newPlaceName: "x".repeat(121),
          newPlaceAddress: "y".repeat(201),
        }),
      ),
    ).toEqual({
      newPlaceName: ["Navnet må højst være 120 tegn."],
      newPlaceAddress: ["Adressen må højst være 200 tegn."],
    });
    expect(
      eventFormSchema.safeParse({ ...base, placeId: "new", newPlaceName: "x".repeat(120) }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        eventFormSchema.safeParse({ ...base, placeId: PLACE_ID, newPlaceName: "x".repeat(2001) }),
      ),
    ).toEqual({ newPlaceName: ["Navnet må højst være 120 tegn."] });
  });

  it("allows no hosts (= the default) and removes duplicates", () => {
    const [a, b] = ids(2);
    expect(eventFormSchema.parse({ ...base, placeId: PLACE_ID }).hostIds).toEqual([]);
    expect(
      eventFormSchema.parse({ ...base, placeId: PLACE_ID, hostIds: [a, b, a] }).hostIds,
    ).toEqual([a, b]);
  });

  it("allows at most 20 hosts", () => {
    expect(
      eventFormSchema.safeParse({ ...base, placeId: PLACE_ID, hostIds: ids(20) }).success,
    ).toBe(true);
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...base, placeId: PLACE_ID, hostIds: ids(21) })),
    ).toEqual({ hostIds: ["Der kan højst være 20 værter."] });
  });

  it("refuses host ids that are not ids", () => {
    expect(
      fieldErrors(eventFormSchema.safeParse({ ...base, placeId: PLACE_ID, hostIds: ["mads"] })),
    ).toEqual({ hostIds: ["Vælg værter fra listen."] });
  });

  it("reads hostIds as a repeated form field", () => {
    const [a, b] = ids(2);
    const form = new FormData();
    for (const [key, value] of Object.entries({ ...base, placeId: PLACE_ID })) form.set(key, value);
    form.append("hostIds", a ?? "");
    form.append("hostIds", b ?? "");
    const values = readFormValues(form, { arrays: EVENT_ARRAY_FIELDS });
    expect(eventFormSchema.parse(values).hostIds).toEqual([a, b]);
  });
});

describe("placeFieldsSchema / createPlaceSchema (SPEC §9.4, D-095)", () => {
  it("cleans the name and turns empty optional texts into null", () => {
    expect(
      placeFieldsSchema.parse({ name: "  Hos \t Mads ", address: " ", description: "" }),
    ).toEqual({ name: "Hos Mads", address: null, description: null });
  });

  it("removes NUL characters", () => {
    expect(placeFieldsSchema.parse({ name: "Hos\u0000 Mads" }).name).toBe("Hos Mads");
    expect(fieldErrors(placeFieldsSchema.safeParse({ name: "\u0000" }))).toEqual({
      name: ["Giv stedet et navn."],
    });
  });

  it("keeps line breaks in the description", () => {
    expect(
      placeFieldsSchema.parse({ name: "Hos Mads", description: " Ring på\r\nbagdøren " })
        .description,
    ).toBe("Ring på\nbagdøren");
  });

  it("enforces the limits (120 / 200 / 1000)", () => {
    expect(
      fieldErrors(
        placeFieldsSchema.safeParse({
          name: "x".repeat(121),
          address: "y".repeat(201),
          description: "z".repeat(1001),
        }),
      ),
    ).toEqual({
      name: ["Navnet må højst være 120 tegn."],
      address: ["Adressen må højst være 200 tegn."],
      description: ["Beskrivelsen må højst være 1000 tegn."],
    });
    expect(placeFieldsSchema.safeParse({ name: "x".repeat(120) }).success).toBe(true);
    expect(fieldErrors(placeFieldsSchema.safeParse({ name: "x".repeat(2001) }))).toEqual({
      name: ["Navnet må højst være 120 tegn."],
    });
  });

  it("reads 'Det er mit sted' as a checkbox", () => {
    expect(createPlaceSchema.parse({ name: "Hos Mads", makeMeOwner: "on" }).makeMeOwner).toBe(true);
    expect(createPlaceSchema.parse({ name: "Hos Mads" }).makeMeOwner).toBe(false);
  });

  it("checks the ids of place, owner and the desired ownership", () => {
    expect(placeRefSchema.safeParse({ clubId: CLUB_ID, placeId: PLACE_ID }).success).toBe(true);
    expect(placeRefSchema.safeParse({ clubId: CLUB_ID, placeId: "nej" }).success).toBe(false);
    expect(
      placeOwnerRefSchema.safeParse({ clubId: CLUB_ID, placeId: PLACE_ID, userId: "x" }).success,
    ).toBe(false);
    expect(
      ownPlaceOwnershipSchema.safeParse({ clubId: CLUB_ID, placeId: PLACE_ID, owned: "true" })
        .success,
    ).toBe(false);
    expect(
      ownPlaceOwnershipSchema.parse({ clubId: CLUB_ID, placeId: PLACE_ID, owned: false }).owned,
    ).toBe(false);
  });
});

describe("updateProfileSchema: nickname (SPEC §9.8, D-105)", () => {
  it("turns an empty nickname into null (clears it)", () => {
    expect(updateProfileSchema.parse({ name: "Jesper", nickname: "" }).nickname).toBeNull();
    expect(updateProfileSchema.parse({ name: "Jesper", nickname: "  \u00a0" }).nickname).toBeNull();
    expect(updateProfileSchema.parse({ name: "Jesper" }).nickname).toBeNull();
  });

  it("cleans the nickname", () => {
    expect(updateProfileSchema.parse({ name: "Jesper", nickname: "  Kap\u0000tajnen  " })).toEqual({
      name: "Jesper",
      nickname: "Kaptajnen",
    });
  });

  it("allows 40 characters (also emoji) and refuses 41", () => {
    expect(NICKNAME_MAX_LENGTH).toBe(40);
    expect(
      updateProfileSchema.safeParse({ name: "Jesper", nickname: "🍺".repeat(40) }).success,
    ).toBe(true);
    expect(
      fieldErrors(updateProfileSchema.safeParse({ name: "Jesper", nickname: "x".repeat(41) })),
    ).toEqual({ nickname: ["Kælenavnet må højst være 40 tegn."] });
  });
});

describe("changePasswordSchema (SPEC §9.8, D-106)", () => {
  const valid = {
    currentPassword: "gammelt-password",
    newPassword: "nyt-password-1",
    confirmPassword: "nyt-password-1",
  };

  it("accepts a new, repeated password", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a mismatch, also while the current password is missing", () => {
    expect(fieldErrors(changePasswordSchema.safeParse({ ...valid, confirmPassword: "x" }))).toEqual(
      { confirmPassword: ["De to passwords er ikke ens."] },
    );
    expect(
      fieldErrors(
        changePasswordSchema.safeParse({ ...valid, currentPassword: "", confirmPassword: "x" }),
      ),
    ).toEqual({
      currentPassword: ["Skriv dit nuværende password."],
      confirmPassword: ["De to passwords er ikke ens."],
    });
  });

  it("refuses the current password as the new one", () => {
    expect(
      fieldErrors(
        changePasswordSchema.safeParse({
          currentPassword: "samme-password",
          newPassword: "samme-password",
          confirmPassword: "samme-password",
        }),
      ),
    ).toEqual({ newPassword: ["Vælg et nyt password, der er forskelligt fra det nuværende."] });
  });

  it("refuses passwords over 128 characters", () => {
    const long = "x".repeat(129);
    expect(
      fieldErrors(
        changePasswordSchema.safeParse({
          currentPassword: long,
          newPassword: long,
          confirmPassword: long,
        }),
      ),
    ).toMatchObject({
      currentPassword: ["Password må højst være 128 tegn."],
      newPassword: ["Password må højst være 128 tegn."],
    });
  });
});

describe("club info, delete and member schemas (SPEC §7.5, §9.8, D-103, D-110)", () => {
  it("allows a description of 300 characters with line breaks, not 301", () => {
    expect(CLUB_DESCRIPTION_MAX_LENGTH).toBe(300);
    expect(
      updateClubInfoSchema.parse({ name: " Drengene ", description: " Fredag\r\nkl. 18 " }),
    ).toEqual({ name: "Drengene", description: "Fredag\nkl. 18" });
    expect(
      updateClubInfoSchema.parse({ name: "Drengene", description: "" }).description,
    ).toBeNull();
    expect(
      updateClubInfoSchema.safeParse({ name: "Drengene", description: "x".repeat(300) }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        updateClubInfoSchema.safeParse({ name: "Drengene", description: "x".repeat(301) }),
      ),
    ).toEqual({ description: ["Beskrivelsen må højst være 300 tegn."] });
  });

  it("reads the typed club name without NUL; missing → ''; over 200 refused", () => {
    expect(deleteClubSchema.parse({ confirmName: "Drengene\u0000" }).confirmName).toBe("Drengene");
    expect(deleteClubSchema.parse({}).confirmName).toBe("");
    expect(fieldErrors(deleteClubSchema.safeParse({ confirmName: "x".repeat(201) }))).toEqual({
      confirmName: ["Skriv klubbens navn præcis, som det står."],
    });
  });

  it("checks member ids and the role", () => {
    const userId = PLACE_ID;
    expect(memberRefSchema.safeParse({ clubId: CLUB_ID, userId }).success).toBe(true);
    expect(memberRefSchema.safeParse({ clubId: CLUB_ID, userId: "x" }).success).toBe(false);
    expect(setMemberRoleSchema.safeParse({ clubId: CLUB_ID, userId, role: "ADMIN" }).success).toBe(
      true,
    );
    expect(setMemberRoleSchema.safeParse({ clubId: CLUB_ID, userId, role: "OWNER" }).success).toBe(
      false,
    );
  });
});
