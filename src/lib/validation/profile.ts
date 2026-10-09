import { z } from "zod";

import { userNameSchema } from "./auth";

/**
 * Zod schema for the basic profile (SPEC §9.8, round 1: name only).
 * The nickname (1–40 characters) arrives in round 3.
 *
 * Client-safe: no server-only imports.
 */

export const updateProfileSchema = z.object({
  name: userNameSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
