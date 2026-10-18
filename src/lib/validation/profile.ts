import { z } from "zod";

import { cleanSingleLine, stripNul } from "@/lib/text";

import {
  EMAIL_MAX_LENGTH,
  emailSchema,
  newPasswordSchema,
  PASSWORD_MAX_LENGTH,
  userNameSchema,
} from "./auth";
import { rawTextLimit } from "./text";

/**
 * Zod schemas for the profile (SPEC §9.8, D-105, D-106, D-151, D-152), shared
 * by the forms (client) and the Server Actions. Messages are Danish.
 *
 *   * updateProfileSchema: the official name (1–100) and the global nickname
 *     (optional, 1–40; "" clears it → null).
 *   * changePasswordSchema: current + new + repeated new password.
 *   * changeEmailSchema: the new email twice + the current password (D-151).
 *   * setPasswordSchema: a first password for a Google-only account, twice
 *     (D-152).
 *
 * Passwords are never echoed back to a form.
 *
 * Client-safe: no server-only imports.
 */

export const NICKNAME_MAX_LENGTH = 40;
const NICKNAME_TOO_LONG = `Kælenavnet må højst være ${NICKNAME_MAX_LENGTH} tegn.`;
/** A raw nickname longer than this is refused before it is cleaned (D-090). */
const NICKNAME_RAW_MAX_LENGTH = 1000;

/** Optional: NUL removed, NFC, whitespace collapsed, trimmed; "" → null (no nickname). */
export const nicknameSchema = z
  .string()
  .max(NICKNAME_RAW_MAX_LENGTH, NICKNAME_TOO_LONG)
  .nullish()
  .transform((value) => {
    const nickname = cleanSingleLine(value ?? "");
    return nickname === "" ? null : nickname;
  })
  .refine(
    (value) => value === null || Array.from(value).length <= NICKNAME_MAX_LENGTH,
    NICKNAME_TOO_LONG,
  );

export const updateProfileSchema = z.object({
  name: userNameSchema,
  nickname: nicknameSchema,
});

const PASSWORD_MISMATCH = "De to passwords er ikke ens.";
const SAME_AS_CURRENT = "Vælg et nyt password, der er forskelligt fra det nuværende.";

/** "Nuværende password" ("Skift password", "Skift email"). Never trimmed: spaces count. */
export const currentPasswordSchema = z
  .string({ error: "Skriv dit nuværende password." })
  .min(1, "Skriv dit nuværende password.")
  .max(PASSWORD_MAX_LENGTH, `Password må højst være ${PASSWORD_MAX_LENGTH} tegn.`);

/** "Gentag nyt password": anything that is not the new password is a mismatch. */
const confirmPasswordSchema = z
  .string({ error: "Gentag dit nye password." })
  .max(PASSWORD_MAX_LENGTH, PASSWORD_MISMATCH);

const changePasswordFields = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
  confirmPassword: confirmPasswordSchema,
});

export const changePasswordSchema = changePasswordFields
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: PASSWORD_MISMATCH,
    path: ["confirmPassword"],
    // Also while the current password is still missing (F-037).
    when: (payload) =>
      changePasswordFields
        .pick({ newPassword: true, confirmPassword: true })
        .safeParse(payload.value).success,
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: SAME_AS_CURRENT,
    path: ["newPassword"],
    when: (payload) =>
      changePasswordFields
        .pick({ currentPassword: true, newPassword: true })
        .safeParse(payload.value).success,
  });

/**
 * "Tilføj password" (D-152): a Google-only account's first password, twice.
 * No current password (there is none); the Server Action asks for a recent
 * Google login instead (isFreshLogin).
 */
const setPasswordFields = z.object({
  newPassword: newPasswordSchema,
  confirmPassword: confirmPasswordSchema,
});

export const setPasswordSchema = setPasswordFields.refine(
  (values) => values.newPassword === values.confirmPassword,
  { message: PASSWORD_MISMATCH, path: ["confirmPassword"] },
);

const EMAIL_MISMATCH = "De to emails er ikke ens.";
/** A raw email longer than this is refused before it is cleaned (D-090). */
const EMAIL_RAW_MAX_LENGTH = rawTextLimit(EMAIL_MAX_LENGTH);

/**
 * "Ny email" (D-151): capped raw, NUL removed, then exactly the sign-up rules
 * (emailSchema: trimmed, at most 254, lowercased, a valid email), so
 * "  Mads@Example.com " is the account mads@example.com.
 */
const newEmailSchema = z
  .string({ error: "Skriv din nye email." })
  .max(EMAIL_RAW_MAX_LENGTH, "Emailen er for lang.")
  .overwrite(stripNul)
  .trim()
  .min(1, "Skriv din nye email.")
  .pipe(emailSchema);

/**
 * "Gentag ny email": normalised like the new email, but never judged on its
 * own; anything else than the new email is a mismatch.
 */
const confirmEmailSchema = z
  .string({ error: "Gentag din nye email." })
  .max(EMAIL_RAW_MAX_LENGTH, EMAIL_MISMATCH)
  .overwrite(stripNul)
  .trim()
  .toLowerCase();

const changeEmailFields = z.object({
  newEmail: newEmailSchema,
  confirmEmail: confirmEmailSchema,
  currentPassword: currentPasswordSchema,
});

export const changeEmailSchema = changeEmailFields.refine(
  (values) => values.newEmail === values.confirmEmail,
  {
    message: EMAIL_MISMATCH,
    path: ["confirmEmail"],
    // Also while the current password is still missing (F-037).
    when: (payload) =>
      changeEmailFields.pick({ newEmail: true, confirmEmail: true }).safeParse(payload.value)
        .success,
  },
);

/**
 * Field names a password form never gets back (readFormValues `exclude`):
 * "Skift password", "Tilføj password" and the password of "Skift email".
 */
export const PASSWORD_FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangeEmailInput = z.input<typeof changeEmailSchema>;
export type ChangeEmailData = z.output<typeof changeEmailSchema>;
export type SetPasswordInput = z.input<typeof setPasswordSchema>;
