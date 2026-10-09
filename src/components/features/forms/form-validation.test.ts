import { describe, expect, it } from "vitest";
import { z } from "zod";

import { signInSchema, signUpSchema } from "@/lib/validation/auth";

import {
  fieldOrderOf,
  firstInvalidField,
  focusIndexInGroup,
  validateFormData,
} from "./form-validation";

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const validSignUp = {
  name: "Jesper",
  email: "Jesper@Example.com ",
  password: "olklubben123",
  confirmPassword: "olklubben123",
};

describe("validateFormData", () => {
  it("godkender en gyldig tilmelding (skjulte felter som next ignoreres)", () => {
    expect(
      validateFormData(signUpSchema, form({ ...validSignUp, next: "/join/K7XMQ2PA" })),
    ).toBeNull();
  });

  it("giver danske beskeder pr. felt", () => {
    const errors = validateFormData(
      signUpSchema,
      form({ name: " ", email: "ikke-en-email", password: "kort", confirmPassword: "kort" }),
    );

    expect(errors).toEqual({
      name: ["Skriv dit navn."],
      email: ["Skriv en gyldig email, fx navn@example.com."],
      password: ["Password skal være mindst 8 tegn."],
    });
  });

  it("fanger to forskellige passwords på feltet 'Gentag password'", () => {
    const errors = validateFormData(
      signUpSchema,
      form({ ...validSignUp, confirmPassword: "olklubben124" }),
    );

    expect(errors).toEqual({ confirmPassword: ["De to passwords er ikke ens."] });
  });

  it("kræver email og password ved login", () => {
    expect(validateFormData(signInSchema, form({ email: "", password: "" }))).toEqual({
      email: ["Skriv din email."],
      password: ["Skriv dit password."],
    });
  });

  it("læser listefelter som lister, også når ingen er valgt", () => {
    const schema = z.object({ hostIds: z.array(z.string()).max(2, "Højst 2.") });

    expect(validateFormData(schema, form({}), { arrays: ["hostIds"] })).toBeNull();
    expect(
      validateFormData(schema, form({ hostIds: ["a", "b"] }), { arrays: ["hostIds"] }),
    ).toBeNull();
    expect(
      validateFormData(schema, form({ hostIds: ["a", "b", "c"] }), { arrays: ["hostIds"] }),
    ).toEqual({ hostIds: ["Højst 2."] });
    // Without `arrays`, a repeated field is just its first value (a string).
    expect(validateFormData(schema, form({ hostIds: ["a"] }))?.hostIds).toHaveLength(1);
  });
});

describe("firstInvalidField", () => {
  it("finder det første felt med fejl i formularens rækkefølge", () => {
    const order = ["next", "name", "email", "password", "confirmPassword"];

    expect(firstInvalidField(order, { password: ["x"], email: ["y"] })).toBe("email");
    expect(firstInvalidField(order, { confirmPassword: ["x"] })).toBe("confirmPassword");
    expect(firstInvalidField(order, { email: [] })).toBeNull();
    expect(firstInvalidField(order, {})).toBeNull();
    expect(firstInvalidField(order, { _form: ["x"] })).toBeNull();
  });
});

describe("fieldOrderOf", () => {
  it("giver hvert navn én gang i DOM-rækkefølge og registrerede felter til sidst", () => {
    const names = ["clubId", null, "title", "placeId", "placeId", "", "hostIds", "hostIds"];

    expect(fieldOrderOf(names)).toEqual(["clubId", "title", "placeId", "hostIds"]);
    expect(fieldOrderOf(names, ["picker", "title"])).toEqual([
      "clubId",
      "title",
      "placeId",
      "hostIds",
      "picker",
    ]);
  });
});

describe("focusIndexInGroup", () => {
  const radio = (checked = false) => ({ type: "radio", checked });
  const checkbox = (checked = false) => ({ type: "checkbox", checked });

  it("fokuserer den valgte radioknap, ellers den første", () => {
    expect(focusIndexInGroup([radio(), radio(true), radio()])).toBe(1);
    expect(focusIndexInGroup([radio(), radio(), radio()])).toBe(0);
  });

  it("fokuserer den første afkrydsningsboks, også når en senere er valgt", () => {
    expect(focusIndexInGroup([checkbox(), checkbox(true)])).toBe(0);
  });

  it("springer skjulte felter over og giver -1, når intet kan få fokus", () => {
    expect(focusIndexInGroup([{ type: "hidden", checked: false }, checkbox()])).toBe(1);
    expect(focusIndexInGroup([{ type: "hidden", checked: false }])).toBe(-1);
    expect(focusIndexInGroup([])).toBe(-1);
  });
});
