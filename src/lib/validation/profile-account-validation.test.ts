import { describe, expect, it } from "vitest";

import { validationError } from "@/lib/action-result";

import { changeEmailSchema, currentPasswordSchema, setPasswordSchema } from "./profile";

/**
 * "Skift email" (D-151) and "Tilføj password" (D-152): the shared schemas
 * behind the Profil forms and their Server Actions.
 */

function fieldErrors(result: { success: boolean; error?: unknown }) {
  if (result.success || !result.error) return {};
  return validationError(result.error as Parameters<typeof validationError>[0]).error.fieldErrors;
}

describe("currentPasswordSchema", () => {
  it("needs a password, keeps spaces and allows at most 128 characters", () => {
    expect(currentPasswordSchema.parse(" med mellemrum ")).toBe(" med mellemrum ");
    expect(currentPasswordSchema.safeParse("").success).toBe(false);
    expect(currentPasswordSchema.safeParse("x".repeat(128)).success).toBe(true);
    expect(currentPasswordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });
});

describe("changeEmailSchema (SPEC §9.8, D-151)", () => {
  const valid = {
    newEmail: "ny@example.com",
    confirmEmail: "ny@example.com",
    currentPassword: "mit-password",
  };

  it("accepts the new email twice with the current password", () => {
    expect(changeEmailSchema.parse(valid)).toEqual(valid);
  });

  it("trims and lowercases both emails, so case and spaces never count", () => {
    expect(
      changeEmailSchema.parse({
        ...valid,
        newEmail: "  Mads@Example.COM ",
        confirmEmail: "mads@example.com\t",
      }),
    ).toEqual({ ...valid, newEmail: "mads@example.com", confirmEmail: "mads@example.com" });
  });

  it("removes NUL before anything else", () => {
    expect(
      changeEmailSchema.parse({
        ...valid,
        newEmail: "ma\u0000ds@example.com",
        confirmEmail: "mads@example.com\u0000",
      }).newEmail,
    ).toBe("mads@example.com");
  });

  it("refuses a missing, invalid or too long email", () => {
    expect(fieldErrors(changeEmailSchema.safeParse({ ...valid, newEmail: "   " }))).toMatchObject({
      newEmail: ["Skriv din nye email."],
    });
    expect(
      fieldErrors(changeEmailSchema.safeParse({ ...valid, newEmail: "ikke-en-email" })),
    ).toEqual({ newEmail: ["Skriv en gyldig email, fx navn@example.com."] });

    const long = `${"a".repeat(243)}@example.com`; // 255 characters
    expect(
      fieldErrors(changeEmailSchema.safeParse({ ...valid, newEmail: long, confirmEmail: long })),
    ).toEqual({ newEmail: ["Emailen er for lang."] });

    // A forged megabyte is refused on its raw length, before it is cleaned.
    const huge = "a".repeat(1_000_000);
    expect(
      fieldErrors(changeEmailSchema.safeParse({ ...valid, newEmail: huge, confirmEmail: huge })),
    ).toEqual({
      newEmail: ["Emailen er for lang."],
      confirmEmail: ["De to emails er ikke ens."],
    });
  });

  it("refuses two different emails on the repeat field, also while the password is missing (F-037)", () => {
    expect(
      fieldErrors(changeEmailSchema.safeParse({ ...valid, confirmEmail: "nu@example.com" })),
    ).toEqual({ confirmEmail: ["De to emails er ikke ens."] });
    expect(
      fieldErrors(
        changeEmailSchema.safeParse({
          newEmail: "ny@example.com",
          confirmEmail: "",
          currentPassword: "",
        }),
      ),
    ).toEqual({
      confirmEmail: ["De to emails er ikke ens."],
      currentPassword: ["Skriv dit nuværende password."],
    });
  });

  it("does not add a mismatch on top of an invalid new email", () => {
    expect(
      fieldErrors(
        changeEmailSchema.safeParse({ ...valid, newEmail: "ikke-en-email", confirmEmail: "x" }),
      ),
    ).toEqual({ newEmail: ["Skriv en gyldig email, fx navn@example.com."] });
  });

  it("needs the current password (at most 128 characters)", () => {
    expect(fieldErrors(changeEmailSchema.safeParse({ ...valid, currentPassword: "" }))).toEqual({
      currentPassword: ["Skriv dit nuværende password."],
    });
    expect(
      fieldErrors(
        changeEmailSchema.safeParse({ newEmail: "ny@example.com", confirmEmail: "ny@example.com" }),
      ),
    ).toEqual({ currentPassword: ["Skriv dit nuværende password."] });
    expect(
      fieldErrors(changeEmailSchema.safeParse({ ...valid, currentPassword: "x".repeat(129) })),
    ).toEqual({ currentPassword: ["Password må højst være 128 tegn."] });
  });
});

describe("setPasswordSchema (SPEC §9.8, D-152)", () => {
  const valid = { newPassword: "nyt-password-1", confirmPassword: "nyt-password-1" };

  it("accepts a new, repeated password", () => {
    expect(setPasswordSchema.parse(valid)).toEqual(valid);
  });

  it("refuses a mismatch on the repeat field", () => {
    expect(
      fieldErrors(setPasswordSchema.safeParse({ ...valid, confirmPassword: "noget-andet" })),
    ).toEqual({ confirmPassword: ["De to passwords er ikke ens."] });
    expect(fieldErrors(setPasswordSchema.safeParse({ newPassword: valid.newPassword }))).toEqual({
      confirmPassword: ["Gentag dit nye password."],
    });
  });

  it("refuses a password under 8 or over 128 characters", () => {
    expect(
      fieldErrors(setPasswordSchema.safeParse({ newPassword: "kort", confirmPassword: "kort" })),
    ).toEqual({ newPassword: ["Password skal være mindst 8 tegn."] });
    const long = "x".repeat(129);
    expect(
      fieldErrors(setPasswordSchema.safeParse({ newPassword: long, confirmPassword: long })),
    ).toEqual({
      newPassword: ["Password må højst være 128 tegn."],
      confirmPassword: ["De to passwords er ikke ens."],
    });
  });
});
