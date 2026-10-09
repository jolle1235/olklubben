import { z } from "zod";

import { stripNul } from "@/lib/text";
import { normalizeInviteCode } from "@/server/domain/clubs/invite-code";

/**
 * Zod schemas for creating and joining a club (SPEC §7.1–7.3), shared by the
 * form (client) and the server. Messages are Danish.
 *
 * Client-safe: invite-code.ts is a pure module without server-only imports.
 */

export const CLUB_NAME_MAX_LENGTH = 60;

/** A club name: NUL-free, trimmed, 1–60 characters (also a CHECK constraint on clubs.name). */
export const clubNameSchema = z
  .string({ error: "Giv klubben et navn." })
  .overwrite(stripNul)
  .trim()
  .min(1, "Giv klubben et navn.")
  .max(CLUB_NAME_MAX_LENGTH, `Klubnavnet må højst være ${CLUB_NAME_MAX_LENGTH} tegn.`);

export const createClubSchema = z.object({
  name: clubNameSchema,
});

export const INVALID_INVITE_CODE_MESSAGE =
  "Koden skal være 8 tegn, fx K7XM-Q2PA. Tjek, at du har skrevet den rigtigt.";

/**
 * Parses user input into the canonical code ("k7xm-q2pa" → "K7XMQ2PA").
 * Valid format only – whether the code exists or is revoked is checked on the
 * server (E18: "Koden virker ikke længere. Spørg efter et nyt link.").
 */
export const inviteCodeSchema = z
  .string({ error: "Skriv invitationskoden." })
  .transform((value, ctx) => {
    const code = normalizeInviteCode(value);
    if (code === null) {
      ctx.addIssue({
        code: "custom",
        message: value.trim() === "" ? "Skriv invitationskoden." : INVALID_INVITE_CODE_MESSAGE,
      });
      return z.NEVER;
    }
    return code;
  });

export const joinClubSchema = z.object({
  code: inviteCodeSchema,
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type JoinClubInput = z.infer<typeof joinClubSchema>;
