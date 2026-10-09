import { z } from "zod";

import { stripNul } from "@/lib/text";
import { normalizeInviteCode } from "@/server/domain/clubs/invite-code";
import { CLUB_ROLES, type ClubRole } from "@/server/domain/clubs/permissions";

import { idSchema } from "./id";
import { optionalText } from "./text";

/**
 * Zod schemas for clubs (SPEC §7, §9.8): create, join, club info, delete and
 * member administration. Shared by the forms (client) and the server.
 * Messages are Danish.
 *
 * Client-safe: the domain modules are pure, without server-only imports.
 */

export const CLUB_NAME_MAX_LENGTH = 60;
export const CLUB_DESCRIPTION_MAX_LENGTH = 300;
/** A typed confirmation longer than this is refused before it is cleaned (D-090). */
const CONFIRM_NAME_MAX_LENGTH = 200;

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

/** "Rediger klubinfo" (admins, D-110): name 1–60, description optional ≤ 300 with line breaks. */
export const updateClubInfoSchema = z.object({
  name: clubNameSchema,
  description: optionalText(
    CLUB_DESCRIPTION_MAX_LENGTH,
    `Beskrivelsen må højst være ${CLUB_DESCRIPTION_MAX_LENGTH} tegn.`,
    { multiline: true },
  ),
});

/**
 * "Slet klubben": the typed club name (NUL removed; missing → ""). Whether it
 * matches is decided in the data layer under the club lock
 * (isClubNameConfirmed; NAME_MISMATCH → fieldErrors.confirmName).
 */
export const CONFIRM_NAME_MISMATCH_MESSAGE = "Skriv klubbens navn præcis, som det står.";

export const deleteClubSchema = z.object({
  confirmName: z
    .string()
    .max(CONFIRM_NAME_MAX_LENGTH, CONFIRM_NAME_MISMATCH_MESSAGE)
    .nullish()
    .transform((value) => stripNul(value ?? "")),
});

/** A member of a club (a Server Action argument). A failed parse → notFound() (§4.4). */
export const memberRefSchema = z.object({ clubId: idSchema, userId: idSchema });

/** "Gør til admin" / "Fjern admin-rollen". */
export const setMemberRoleSchema = memberRefSchema.extend({
  role: z.enum(CLUB_ROLES as [ClubRole, ...ClubRole[]]),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type JoinClubInput = z.infer<typeof joinClubSchema>;
export type UpdateClubInfoInput = z.input<typeof updateClubInfoSchema>;
export type UpdateClubInfoData = z.output<typeof updateClubInfoSchema>;
