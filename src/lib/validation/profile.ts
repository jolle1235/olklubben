import { z } from "zod";

import { cleanSingleLine } from "@/lib/text";

import { newPasswordSchema, PASSWORD_MAX_LENGTH, userNameSchema } from "./auth";

/**
 * Zod schemas for the profile (SPEC §9.8, D-105, D-106), shared by the forms
 * (client) and the Server Actions. Messages are Danish.
 *
 *   * updateProfileSchema: the official name (1–100) and the global nickname
 *     (optional, 1–40; "" clears it → null).
 *   * changePasswordSchema: current + new + repeated new password. Passwords
 *     are never echoed back to the form.
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

const changePasswordFields = z.object({
  currentPassword: z
    .string({ error: "Skriv dit nuværende password." })
    .min(1, "Skriv dit nuværende password.")
    .max(PASSWORD_MAX_LENGTH, `Password må højst være ${PASSWORD_MAX_LENGTH} tegn.`),
  newPassword: newPasswordSchema,
  confirmPassword: z
    .string({ error: "Gentag dit nye password." })
    .max(PASSWORD_MAX_LENGTH, PASSWORD_MISMATCH),
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

/** Field names the change-password form never gets back (readFormValues `exclude`). */
export const PASSWORD_FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
