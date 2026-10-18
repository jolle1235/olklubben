import { z } from "zod";

import { stripNul } from "@/lib/text";

/**
 * Zod schemas for the auth forms (SPEC §6), shared by the form (client) and
 * the server. Messages are Danish and shown next to the field.
 *
 * Better Auth enforces the same password length on the server
 * (src/server/auth/auth.ts uses PASSWORD_MIN_LENGTH/PASSWORD_MAX_LENGTH).
 *
 * Client-safe: no server-only imports.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USER_NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

/** A person's name: NUL-free, trimmed, 1–100 characters. */
export const userNameSchema = z
  .string({ error: "Skriv dit navn." })
  .overwrite(stripNul)
  .trim()
  .min(1, "Skriv dit navn.")
  .max(USER_NAME_MAX_LENGTH, `Navnet må højst være ${USER_NAME_MAX_LENGTH} tegn.`);

/** Trimmed and lowercased, so "Jesper@Example.com " and "jesper@example.com" are the same account. */
export const emailSchema = z
  .string({ error: "Skriv din email." })
  .trim()
  .min(1, "Skriv din email.")
  .max(EMAIL_MAX_LENGTH, "Emailen er for lang.")
  .toLowerCase()
  .pipe(z.email("Skriv en gyldig email, fx navn@example.com."));

/** A new password (sign-up, reset). */
export const newPasswordSchema = z
  .string({ error: "Vælg et password." })
  .min(PASSWORD_MIN_LENGTH, `Password skal være mindst ${PASSWORD_MIN_LENGTH} tegn.`)
  .max(PASSWORD_MAX_LENGTH, `Password må højst være ${PASSWORD_MAX_LENGTH} tegn.`);

const PASSWORD_MISMATCH = "De to passwords er ikke ens.";

export const signUpSchema = z
  .object({
    name: userNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string({ error: "Gentag dit password." }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORD_MISMATCH,
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: emailSchema,
  // No length rule here: the error must stay generic (SPEC §6.3).
  password: z.string({ error: "Skriv dit password." }).min(1, "Skriv dit password."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string({ error: "Linket mangler en kode." }).min(1, "Linket mangler en kode."),
    password: newPasswordSchema,
    confirmPassword: z.string({ error: "Gentag dit password." }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORD_MISMATCH,
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
