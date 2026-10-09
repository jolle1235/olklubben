import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/validation/auth";

import { firstInvalidField, formDataToValues, validateFormData } from "./form-validation";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

const validSignUp = {
  name: "Jesper",
  email: "Jesper@Example.com ",
  password: "olklubben123",
  confirmPassword: "olklubben123",
};

describe("formDataToValues", () => {
  it("tager tekstværdier og den første af gentagne nøgler", () => {
    const data = form({ email: "a@b.dk" });
    data.append("email", "andet@b.dk");
    data.append("fil", new Blob(["x"]), "x.txt");

    expect(formDataToValues(data)).toEqual({ email: "a@b.dk" });
  });
});

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
});

describe("firstInvalidField", () => {
  it("finder det første felt med fejl i formularens rækkefølge", () => {
    const order = ["next", "name", "email", "password", "confirmPassword"];

    expect(firstInvalidField(order, { password: ["x"], email: ["y"] })).toBe("email");
    expect(firstInvalidField(order, { confirmPassword: ["x"] })).toBe("confirmPassword");
    expect(firstInvalidField(order, { email: [] })).toBeNull();
    expect(firstInvalidField(order, {})).toBeNull();
  });
});
