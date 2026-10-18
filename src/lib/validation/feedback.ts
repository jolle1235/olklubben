import { z } from "zod";

import { cleanSingleLine, stripNul } from "@/lib/text";
import { toFeedbackPagePath } from "@/server/domain/feedback/page-path";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackStatus,
  type FeedbackType,
} from "@/server/domain/feedback/status";

import { idSchema } from "./id";
import { optionalId, optionalText, rawTextLimit } from "./text";

/**
 * Zod schemas for feedback (SPEC §9.9, D-141–D-145), shared by the forms
 * (client) and the Server Actions. Messages are Danish.
 *
 *   * type: "BUG" (Fejl) or "FEATURE" (Idé / ønske).
 *   * title: one line (cleanSingleLine), 3–120 characters.
 *   * description: line breaks kept (CRLF → "\n"), NFC, trimmed, 10–5000.
 *   * pagePath (bugs only): toFeedbackPagePath – the club id, query and hash
 *     are removed (E26, D-143). A typed value that is not a path is a field
 *     error; empty = no page.
 *   * viewportWidth (bugs only): an integer 1–20 000 that the form fills in
 *     from the browser; anything else is silently dropped (null).
 *
 * Lengths are counted in code points, like Postgres' char_length in the
 * CHECKs (an emoji is one character there, two UTF-16 units in JS), so a
 * value the schema accepts is never refused by the database.
 *
 * Every free text strips U+0000 and is capped raw BEFORE it is cleaned
 * (D-090, F-044). Client-safe: the domain modules are pure.
 */

export const FEEDBACK_TITLE_MIN_LENGTH = 3;
export const FEEDBACK_TITLE_MAX_LENGTH = 120;
export const FEEDBACK_DESCRIPTION_MIN_LENGTH = 10;
export const FEEDBACK_DESCRIPTION_MAX_LENGTH = 5000;
export const FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH = 2000;
export const FEEDBACK_USER_AGENT_MAX_LENGTH = 500;
export const FEEDBACK_VIEWPORT_WIDTH_MIN = 1;
export const FEEDBACK_VIEWPORT_WIDTH_MAX = 20_000;

// ── Messages ────────────────────────────────────────────────────────────────

const TYPE_REQUIRED = "Vælg, om det er en fejl eller en idé.";
const TITLE_TOO_SHORT = `Titlen skal være mindst ${FEEDBACK_TITLE_MIN_LENGTH} tegn.`;
const TITLE_TOO_LONG = `Titlen må højst være ${FEEDBACK_TITLE_MAX_LENGTH} tegn.`;
const DESCRIPTION_TOO_SHORT = `Beskriv det med mindst ${FEEDBACK_DESCRIPTION_MIN_LENGTH} tegn.`;
const DESCRIPTION_TOO_LONG = `Beskrivelsen må højst være ${FEEDBACK_DESCRIPTION_MAX_LENGTH} tegn.`;
const PAGE_PATH_INVALID = "Skriv en sti, fx /calendar.";
const STATUS_REQUIRED = "Vælg en status.";
const ADMIN_RESPONSE_TOO_LONG = `Svaret må højst være ${FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH} tegn.`;
export const DUPLICATE_TARGET_REQUIRED_MESSAGE = "Vælg den originale rapport.";
export const DUPLICATE_OF_SELF_MESSAGE = "En rapport kan ikke være dublet af sig selv.";

/** A raw page path longer than this is refused before it is normalised. */
const PAGE_PATH_RAW_MAX_LENGTH = 2048;

// ── Output contracts ────────────────────────────────────────────────────────

/** What createFeedback stores (the action adds the user agent from the request). */
export type FeedbackCreateData = {
  type: FeedbackType;
  title: string;
  description: string;
  /** BUG only (null for FEATURE): normalised by toFeedbackPagePath. */
  pagePath: string | null;
  /** BUG only (null for FEATURE): 1–20 000, or null. */
  viewportWidth: number | null;
};

export type FeedbackEditData = {
  feedbackId: string;
  title: string;
  description: string;
};

export type FeedbackModerationData = {
  feedbackId: string;
  status: FeedbackStatus;
  adminResponse: string | null;
  /** Set exactly when status is DUPLICATE, never the report itself. */
  duplicateOfId: string | null;
};

export type FeedbackVoteData = { feedbackId: string; voted: boolean };

// ── Fields ──────────────────────────────────────────────────────────────────

/** Postgres char_length: code points, not UTF-16 units. */
function codePointLength(value: string): number {
  return [...value].length;
}

/** The stored description: NUL removed, CRLF → "\n", NFC, trimmed. */
export function cleanFeedbackDescription(value: string): string {
  return stripNul(value).replace(/\r\n?/g, "\n").normalize("NFC").trim();
}

function boundedText(options: {
  clean: (value: string) => string;
  min: number;
  max: number;
  tooShort: string;
  tooLong: string;
}) {
  return z
    .string({ error: options.tooShort })
    .max(rawTextLimit(options.max), { error: options.tooLong, abort: true })
    .transform(options.clean)
    .superRefine((value, ctx) => {
      const length = codePointLength(value);
      if (length < options.min) ctx.addIssue({ code: "custom", message: options.tooShort });
      else if (length > options.max) ctx.addIssue({ code: "custom", message: options.tooLong });
    });
}

const titleField = boundedText({
  clean: cleanSingleLine,
  min: FEEDBACK_TITLE_MIN_LENGTH,
  max: FEEDBACK_TITLE_MAX_LENGTH,
  tooShort: TITLE_TOO_SHORT,
  tooLong: TITLE_TOO_LONG,
});

const descriptionField = boundedText({
  clean: cleanFeedbackDescription,
  min: FEEDBACK_DESCRIPTION_MIN_LENGTH,
  max: FEEDBACK_DESCRIPTION_MAX_LENGTH,
  tooShort: DESCRIPTION_TOO_SHORT,
  tooLong: DESCRIPTION_TOO_LONG,
});

const typeField = z.enum(FEEDBACK_TYPES as [FeedbackType, ...FeedbackType[]], {
  error: TYPE_REQUIRED,
});

/** The typed page, trimmed ("" = none). Normalised (or refused) below, for bugs only. */
const pagePathField = z
  .string()
  .max(PAGE_PATH_RAW_MAX_LENGTH, { error: PAGE_PATH_INVALID, abort: true })
  .nullish()
  .transform((value) => stripNul(value ?? "").trim());

/** "390" → 390. Anything that is not a whole number 1–20 000 → null, silently. */
const viewportWidthField = z
  .union([z.string().max(20), z.number()])
  .nullish()
  .catch(null)
  .transform((value): number | null => {
    const text = typeof value === "number" ? String(value) : (value ?? "").trim();
    if (!/^\d{1,5}$/.test(text)) return null;
    const width = Number(text);
    return width >= FEEDBACK_VIEWPORT_WIDTH_MIN && width <= FEEDBACK_VIEWPORT_WIDTH_MAX
      ? width
      : null;
  });

// ── Create ──────────────────────────────────────────────────────────────────

const feedbackFieldsSchema = z.object({
  type: typeField,
  title: titleField,
  description: descriptionField,
  pagePath: pagePathField,
  viewportWidth: viewportWidthField,
});

/**
 * "Ny rapport" (/feedback/new). Form fields: type, title, description,
 * pagePath (bugs), viewportWidth (hidden, bugs). For a FEATURE the page and
 * the width are dropped, whatever was sent.
 */
export const feedbackFormSchema = feedbackFieldsSchema
  .superRefine(
    (values, ctx) => {
      if (values.type !== "BUG" || values.pagePath === "") return;
      if (toFeedbackPagePath(values.pagePath) === null) {
        ctx.addIssue({ code: "custom", path: ["pagePath"], message: PAGE_PATH_INVALID });
      }
    },
    {
      // F-037: run while other fields are invalid too, as long as these two parse.
      when: (payload) =>
        feedbackFieldsSchema.pick({ type: true, pagePath: true }).safeParse(payload.value).success,
    },
  )
  .transform((values): FeedbackCreateData => ({
    type: values.type,
    title: values.title,
    description: values.description,
    pagePath: values.type === "BUG" ? toFeedbackPagePath(values.pagePath) : null,
    viewportWidth: values.type === "BUG" ? values.viewportWidth : null,
  }));

/** The create form's raw values (as typed). */
export type FeedbackFormInput = z.input<typeof feedbackFormSchema>;

// ── Edit (author while NEW, or an app-admin) ────────────────────────────────

export const feedbackEditSchema = z.object({
  feedbackId: idSchema,
  title: titleField,
  description: descriptionField,
});

export type FeedbackEditInput = z.input<typeof feedbackEditSchema>;

// ── Moderation (app-admins) ─────────────────────────────────────────────────

const moderationFieldsSchema = z.object({
  feedbackId: idSchema,
  status: z.enum(FEEDBACK_STATUSES as [FeedbackStatus, ...FeedbackStatus[]], {
    error: STATUS_REQUIRED,
  }),
  adminResponse: optionalText(FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH, ADMIN_RESPONSE_TOO_LONG, {
    multiline: true,
  }),
  duplicateOfId: optionalId(DUPLICATE_TARGET_REQUIRED_MESSAGE),
});

/**
 * Status, answer and duplicate (§9.9 "Detaljeside", E28). duplicateOfId is
 * required for DUPLICATE and must not be the report itself; for any other
 * status it is ignored (null). Whether the original exists and is not itself
 * a duplicate is decided under row locks in the data layer (moderateFeedback).
 */
export const feedbackModerationSchema = moderationFieldsSchema
  .superRefine(
    (values, ctx) => {
      if (values.status !== "DUPLICATE") return;
      if (values.duplicateOfId === null) {
        ctx.addIssue({
          code: "custom",
          path: ["duplicateOfId"],
          message: DUPLICATE_TARGET_REQUIRED_MESSAGE,
        });
      } else if (values.duplicateOfId === values.feedbackId) {
        ctx.addIssue({
          code: "custom",
          path: ["duplicateOfId"],
          message: DUPLICATE_OF_SELF_MESSAGE,
        });
      }
    },
    {
      when: (payload) =>
        moderationFieldsSchema
          .pick({ feedbackId: true, status: true, duplicateOfId: true })
          .safeParse(payload.value).success,
    },
  )
  .transform((values): FeedbackModerationData => ({
    feedbackId: values.feedbackId,
    status: values.status,
    adminResponse: values.adminResponse,
    duplicateOfId: values.status === "DUPLICATE" ? values.duplicateOfId : null,
  }));

export type FeedbackModerationInput = z.input<typeof feedbackModerationSchema>;

// ── 👍 and references ───────────────────────────────────────────────────────

/** The 👍 toggle sends the desired state ("1"/"0", "on", or a boolean). */
export const feedbackVoteSchema = z.object({
  feedbackId: idSchema,
  voted: z
    .union([z.boolean(), z.enum(["1", "0", "true", "false", "on"])])
    .transform((value) => value === true || value === "1" || value === "true" || value === "on"),
});

/** Which report an action is about. A failed parse → notFound(). */
export const feedbackRefSchema = z.object({ feedbackId: idSchema });

// The schemas' outputs must stay exactly the contract types above.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _createIsContract: Exact<z.output<typeof feedbackFormSchema>, FeedbackCreateData> = true;
const _editIsContract: Exact<z.output<typeof feedbackEditSchema>, FeedbackEditData> = true;
const _moderationIsContract: Exact<
  z.output<typeof feedbackModerationSchema>,
  FeedbackModerationData
> = true;
const _voteIsContract: Exact<z.output<typeof feedbackVoteSchema>, FeedbackVoteData> = true;
void _createIsContract;
void _editIsContract;
void _moderationIsContract;
void _voteIsContract;
