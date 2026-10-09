import { describe, expect, it } from "vitest";

import { validationError } from "@/lib/action-result";

import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./auth";
import { createClubSchema, joinClubSchema } from "./club";
import { updateProfileSchema } from "./profile";

function fieldErrors(result: { success: boolean; error?: unknown }) {
  if (result.success || !result.error) return {};
  return validationError(result.error as Parameters<typeof validationError>[0]).error.fieldErrors;
}

describe("signUpSchema", () => {
  const valid = {
    name: "  Jesper ",
    email: " Jesper@Example.COM ",
    password: "ølklubben123",
    confirmPassword: "ølklubben123",
  };

  it("trims the name and lowercases the email", () => {
    expect(signUpSchema.parse(valid)).toEqual({
      name: "Jesper",
      email: "jesper@example.com",
      password: "ølklubben123",
      confirmPassword: "ølklubben123",
    });
  });

  it("requires a name of at most 100 characters", () => {
    expect(fieldErrors(signUpSchema.safeParse({ ...valid, name: "  " }))).toMatchObject({
      name: ["Skriv dit navn."],
    });
    expect(fieldErrors(signUpSchema.safeParse({ ...valid, name: "x".repeat(101) }))).toMatchObject({
      name: ["Navnet må højst være 100 tegn."],
    });
  });

  it("rejects an invalid email", () => {
    expect(fieldErrors(signUpSchema.safeParse({ ...valid, email: "jesper" }))).toMatchObject({
      email: [expect.stringContaining("gyldig email")],
    });
    expect(fieldErrors(signUpSchema.safeParse({ ...valid, email: "" }))).toMatchObject({
      email: ["Skriv din email."],
    });
  });

  it("requires a password of at least 8 characters", () => {
    expect(
      fieldErrors(signUpSchema.safeParse({ ...valid, password: "kort", confirmPassword: "kort" })),
    ).toMatchObject({ password: ["Password skal være mindst 8 tegn."] });
  });

  it("requires the two passwords to match", () => {
    expect(
      fieldErrors(signUpSchema.safeParse({ ...valid, confirmPassword: "ølklubben124" })),
    ).toMatchObject({ confirmPassword: ["De to passwords er ikke ens."] });
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password (no hints about the rules)", () => {
    expect(signInSchema.parse({ email: "A@B.DK", password: "x" })).toEqual({
      email: "a@b.dk",
      password: "x",
    });
    expect(fieldErrors(signInSchema.safeParse({ email: "a@b.dk", password: "" }))).toMatchObject({
      password: ["Skriv dit password."],
    });
  });
});

describe("forgotPasswordSchema / resetPasswordSchema", () => {
  it("normalizes the email", () => {
    expect(forgotPasswordSchema.parse({ email: " Mads@Example.com" })).toEqual({
      email: "mads@example.com",
    });
  });

  it("needs a token and two matching passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "abc",
        password: "nytpassword",
        confirmPassword: "nytpassword",
      }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        resetPasswordSchema.safeParse({
          token: "",
          password: "nytpassword",
          confirmPassword: "andet123",
        }),
      ),
    ).toMatchObject({
      token: ["Linket mangler en kode."],
      confirmPassword: ["De to passwords er ikke ens."],
    });
  });
});

describe("createClubSchema", () => {
  it("trims the name and allows 1–60 characters", () => {
    expect(createClubSchema.parse({ name: "  Drengene & Bajere " })).toEqual({
      name: "Drengene & Bajere",
    });
    expect(fieldErrors(createClubSchema.safeParse({ name: "   " }))).toMatchObject({
      name: ["Giv klubben et navn."],
    });
    expect(fieldErrors(createClubSchema.safeParse({ name: "x".repeat(61) }))).toMatchObject({
      name: ["Klubnavnet må højst være 60 tegn."],
    });
    expect(createClubSchema.safeParse({ name: "x".repeat(60) }).success).toBe(true);
  });

  it("removes NUL characters, which Postgres text cannot store", () => {
    expect(createClubSchema.parse({ name: "Drengene\u0000 & Bajere" })).toEqual({
      name: "Drengene & Bajere",
    });
    expect(createClubSchema.safeParse({ name: "\u0000" }).success).toBe(false);
  });
});

describe("joinClubSchema", () => {
  it("returns the canonical code", () => {
    expect(joinClubSchema.parse({ code: "k7xm-q2pa" })).toEqual({ code: "K7XMQ2PA" });
  });

  it("explains a malformed code", () => {
    expect(fieldErrors(joinClubSchema.safeParse({ code: "K7XM-Q2P0" }))).toMatchObject({
      code: [expect.stringContaining("8 tegn")],
    });
    expect(fieldErrors(joinClubSchema.safeParse({ code: "  " }))).toMatchObject({
      code: ["Skriv invitationskoden."],
    });
  });
});

describe("updateProfileSchema", () => {
  it("trims the name and allows 1–100 characters", () => {
    expect(updateProfileSchema.parse({ name: " Anders " })).toEqual({ name: "Anders" });
    expect(updateProfileSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("removes NUL characters", () => {
    expect(updateProfileSchema.parse({ name: "An\u0000ders" })).toEqual({ name: "Anders" });
    expect(updateProfileSchema.safeParse({ name: "\u0000" }).success).toBe(false);
  });
});
