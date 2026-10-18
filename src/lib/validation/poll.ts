import { z } from "zod";

import { formatWeekdayDateTime } from "@/lib/format/date";
import { stripNul } from "@/lib/text";
import { isDateKey, normalizeTimeOfDay, zonedDateTimeToUtc } from "@/server/domain/events/time";
import {
  cleanPlaceName,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
} from "@/server/domain/places/name";
import type { BallotChoice, BallotErrorCode } from "@/server/domain/polls/ballot";
import {
  hasSomethingToVoteOn,
  MAX_POLL_DATE_OPTIONS,
  MAX_POLL_PLACE_OPTIONS,
} from "@/server/domain/polls/options";
import type { PollTimingError } from "@/server/domain/polls/schedule";
import { dateOptionInstants } from "@/server/domain/polls/schedule";
import type { Resolutions } from "@/server/domain/polls/tally";

import {
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_THEME_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  NEW_PLACE_NAME_REQUIRED_MESSAGE,
} from "./event";
import { idSchema } from "./id";
import {
  checkboxSchema,
  cleanOptionalText,
  idListSchema,
  optionalId,
  optionalText,
  rawTextLimit,
} from "./text";

/**
 * Zod schemas for polls ("Planlæg ølsmagning", SPEC §9.7, D-134, D-135,
 * D-153), shared by the forms (client) and the Server Actions. Messages are
 * Danish.
 *
 * Pure: nothing here depends on the clock. "Dates and the deadline lie in the
 * future" and "the deadline only moves later" are checked on the server
 * (checkPollTiming in src/server/domain/polls/schedule.ts, in the action and
 * again under the poll lock) and shown with pollTimingMessage().
 *
 *   * dates: repeated <input type="date" name="dates"> rows ("YYYY-MM-DD",
 *     Copenhagen). Empty rows are dropped. Every date starts at the shared
 *     startTime (D-134).
 *   * placeIds: repeated checkboxes with the club's places, plus the
 *     "＋ Nyt sted" checkbox (newPlace) with newPlaceName / newPlaceAddress /
 *     newPlaceMine – the same field names and messages as the event form.
 *     Whether a place exists in the club and is active is checked on the
 *     server (PlaceNotSelectableError → POLL_PLACE_ERROR_MESSAGES).
 *   * deadlineDate + deadlineTime: the deadline (Copenhagen wall clock).
 *   * editOptions (edit only): a hidden checkbox the edit form sends while
 *     nobody has voted (D-153). Set, the edit form is parsed by
 *     pollFormSchema itself – the same option fields, messages and checks as
 *     on create; unset, only the texts and the deadline.
 *
 * Every free text strips U+0000 and is capped raw BEFORE trimming or any
 * regex (D-090, F-044). Object-level checks run while other fields are invalid
 * (`when`, F-037), and a field never gets two messages (F-056).
 *
 * Client-safe: the domain modules are pure.
 */

export const POLL_TITLE_MAX_LENGTH = EVENT_TITLE_MAX_LENGTH;
export const POLL_THEME_MAX_LENGTH = EVENT_THEME_MAX_LENGTH;
export const POLL_DESCRIPTION_MAX_LENGTH = EVENT_DESCRIPTION_MAX_LENGTH;

/** Repeated form fields (readFormValues / useActionForm `arrayFields`). */
export const POLL_ARRAY_FIELDS = ["dates", "placeIds"] as const;
export const BALLOT_ARRAY_FIELDS = ["dateOptionIds"] as const;

/** Ids of one poll (URL, bound arguments, hidden fields). A failed parse → notFound(). */
export const pollRefSchema = z.object({ clubId: idSchema, pollId: idSchema });

/** The places of a new poll: chosen ones and/or "＋ Nyt sted" (found or created by name, E29). */
export type PollPlacesInput = {
  existingIds: string[];
  newPlace: { name: string; address: string | null; ownedByCreator: boolean } | null;
};

/** What createPoll stores (the data layer re-checks timing under its locks). */
export type PollFormData = {
  title: string;
  theme: string | null;
  description: string | null;
  /** UTC instants, ascending, deduplicated. */
  dateStartsAt: Date[];
  places: PollPlacesInput;
  deadline: Date;
};

/** New dates and places for an existing poll (D-153: only while nobody has voted). */
export type PollOptionsData = {
  /** UTC instants, ascending, deduplicated. */
  dateStartsAt: Date[];
  places: PollPlacesInput;
};

/** What updatePoll stores (D-153). */
export type PollEditData = {
  title: string;
  theme: string | null;
  description: string | null;
  deadline: Date;
  /** The edit form's new options (editOptions set), or null: the options stay as they are. */
  options: PollOptionsData | null;
};

// ── Messages ────────────────────────────────────────────────────────────────

const TITLE_REQUIRED = "Giv afstemningen en titel.";
const TITLE_TOO_LONG = `Titlen må højst være ${POLL_TITLE_MAX_LENGTH} tegn.`;
const THEME_TOO_LONG = `Temaet må højst være ${POLL_THEME_MAX_LENGTH} tegn.`;
const DESCRIPTION_TOO_LONG = `Beskrivelsen må højst være ${POLL_DESCRIPTION_MAX_LENGTH} tegn.`;

const DATES_REQUIRED = "Tilføj mindst én dato.";
const DATES_TOO_MANY = `Der kan højst være ${MAX_POLL_DATE_OPTIONS} datoer.`;
const DATE_INVALID = "Datoen findes ikke. Vælg en anden dato.";
const DATE_DUPLICATE = "Du har valgt samme dato to gange.";

const PLACES_TOO_MANY = `Der kan højst være ${MAX_POLL_PLACE_OPTIONS} steder.`;
const PLACES_INVALID = "Vælg steder fra listen.";
const PLACES_REQUIRED = "Vælg mindst ét sted, eller opret et nyt.";

const NEW_PLACE_NAME_TOO_LONG = `Navnet må højst være ${PLACE_NAME_MAX_LENGTH} tegn.`;
const NEW_PLACE_ADDRESS_TOO_LONG = `Adressen må højst være ${PLACE_ADDRESS_MAX_LENGTH} tegn.`;
const NEW_PLACE_NAME_RAW_MAX_LENGTH = 2000;

const DEADLINE_DATE_REQUIRED = "Vælg en dato for fristen.";
const DEADLINE_TIME_REQUIRED = "Vælg et tidspunkt for fristen.";
const DEADLINE_TIME_INVALID = "Skriv tiden som tt:mm, fx 20:00.";

/** Fewer than two options in both categories (D-134, C16). Also the action's "nothing-to-vote". */
export const NOTHING_TO_VOTE_MESSAGE =
  "Tilføj mindst to datoer eller to steder, så der er noget at stemme om. Ligger alt fast, så opret et event i stedet.";

/** updatePoll's options-locked (D-153): the first ballot came between loading and saving the form. */
export const POLL_OPTIONS_LOCKED_MESSAGE =
  "Nogen har stemt i mellemtiden, så datoer og steder kan ikke længere ændres. Intet er gemt.";

/** createPoll's and updatePoll's PlaceNotSelectableError, on placeIds. */
export const POLL_PLACE_ERROR_MESSAGES = {
  NOT_FOUND: "Et af stederne findes ikke længere. Vælg igen.",
  ARCHIVED: "Et af stederne er arkiveret. Vælg et andet.",
} as const;

/** "Fristen skal ligge før den første dato (lørdag 24. oktober kl. 18:30)." */
export function deadlineBeforeFirstDateMessage(firstDate: Date): string {
  return `Fristen skal ligge før den første dato (${formatWeekdayDateTime(firstDate)}).`;
}

export type PollTimingField = "dates" | "deadlineDate";

/**
 * The field and message for a server-side timing error (checkPollTiming).
 * `firstDate` is the earliest date option; `previousDeadline` the stored
 * deadline (edit).
 */
export function pollTimingMessage(
  error: PollTimingError,
  context: { firstDate?: Date | null; previousDeadline?: Date | null } = {},
): { field: PollTimingField; message: string } {
  switch (error) {
    case "DATE_PAST":
      return { field: "dates", message: "Datoerne skal ligge i fremtiden." };
    case "DEADLINE_PAST":
      return { field: "deadlineDate", message: "Fristen skal ligge i fremtiden." };
    case "DEADLINE_NOT_BEFORE_FIRST_DATE":
      return {
        field: "deadlineDate",
        message: context.firstDate
          ? deadlineBeforeFirstDateMessage(context.firstDate)
          : "Fristen skal ligge før den første dato.",
      };
    case "DEADLINE_SHORTENED":
      return {
        field: "deadlineDate",
        message: context.previousDeadline
          ? `Fristen kan kun rykkes senere (nu: ${formatWeekdayDateTime(context.previousDeadline)}).`
          : "Fristen kan kun rykkes senere.",
      };
  }
}

const DATE_AND_NONE_MESSAGE = "Vælg enten datoer eller «Ingen af datoerne passer mig».";

/**
 * The field and message for castBallot's domain error codes. `field` null =
 * a form error (the poll changed under the voter: reload).
 */
export function ballotMessage(code: BallotErrorCode): {
  field: "dateOptionIds" | "placeOptionId" | null;
  message: string;
} {
  switch (code) {
    case "DATE_REQUIRED":
      return {
        field: "dateOptionIds",
        message: "Sæt kryds ved mindst én dato, eller vælg «Ingen af datoerne passer mig».",
      };
    case "DATE_AND_NONE":
      return { field: "dateOptionIds", message: DATE_AND_NONE_MESSAGE };
    case "PLACE_REQUIRED":
      return { field: "placeOptionId", message: "Vælg et sted." };
    case "UNKNOWN_OPTION":
      return { field: null, message: "Afstemningen er ændret. Genindlæs siden." };
  }
}

/** resolvePollTie's invalid-choice, per category (field dateOptionId / placeOptionId). */
export const TIE_CHOICE_MESSAGES = {
  DATE: "Vælg en af de datoer, der står lige.",
  PLACE: "Vælg et af de steder, der står lige.",
} as const;

// ── Fields ──────────────────────────────────────────────────────────────────

// `abort: true`: an empty field shows only "required", not also "invalid".
const timeField = (required: string, invalid: string) =>
  z
    .string({ error: required })
    .max(20, { error: invalid, abort: true })
    .trim()
    .min(1, { error: required, abort: true })
    .refine((value) => normalizeTimeOfDay(value) !== null, invalid)
    .transform((value) => normalizeTimeOfDay(value) as string);

const dateField = (required: string) =>
  z
    .string({ error: required })
    .max(20, { error: DATE_INVALID, abort: true })
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") ctx.addIssue({ code: "custom", message: required });
      else if (!isDateKey(value)) ctx.addIssue({ code: "custom", message: DATE_INVALID });
    });

const titleField = z
  .string({ error: TITLE_REQUIRED })
  .max(rawTextLimit(POLL_TITLE_MAX_LENGTH), { error: TITLE_TOO_LONG, abort: true })
  .overwrite(stripNul)
  .trim()
  .min(1, TITLE_REQUIRED)
  .max(POLL_TITLE_MAX_LENGTH, TITLE_TOO_LONG);

const themeField = optionalText(POLL_THEME_MAX_LENGTH, THEME_TOO_LONG);
const descriptionField = optionalText(POLL_DESCRIPTION_MAX_LENGTH, DESCRIPTION_TOO_LONG, {
  multiline: true,
});

/** The raw rows a forged request may send before the list is refused outright. */
const DATE_ROWS_RAW_MAX = 50;

/**
 * The date rows: every raw item ≤ 20 characters (refused before anything
 * else), "" rows dropped, then ONE message for the field: required, too many,
 * an impossible date, or a duplicate.
 */
const datesField = z
  .union([z.array(z.string()), z.string()])
  .nullish()
  .transform((value) => (value == null ? [] : Array.isArray(value) ? value : [value]))
  .pipe(
    z.array(z.string()).superRefine((rows, ctx) => {
      if (rows.length > DATE_ROWS_RAW_MAX) {
        ctx.addIssue({ code: "custom", message: DATES_TOO_MANY });
        return;
      }
      if (rows.some((row) => row.length > 20)) {
        ctx.addIssue({ code: "custom", message: DATE_INVALID });
        return;
      }
      const dates = rows.map((row) => row.trim()).filter((row) => row !== "");
      if (dates.length === 0) ctx.addIssue({ code: "custom", message: DATES_REQUIRED });
      else if (dates.length > MAX_POLL_DATE_OPTIONS) {
        ctx.addIssue({ code: "custom", message: DATES_TOO_MANY });
      } else if (!dates.every((date) => isDateKey(date))) {
        ctx.addIssue({ code: "custom", message: DATE_INVALID });
      } else if (new Set(dates).size !== dates.length) {
        ctx.addIssue({ code: "custom", message: DATE_DUPLICATE });
      }
    }),
  )
  .transform((rows) => rows.map((row) => row.trim()).filter((row) => row !== ""));

/** Titel, Tema and Beskrivelse: create, and edit at any time. */
const textFields = { title: titleField, theme: themeField, description: descriptionField };

/** Afstemningsfrist: create, and edit at any time. */
const deadlineFields = {
  deadlineDate: dateField(DEADLINE_DATE_REQUIRED),
  deadlineTime: timeField(DEADLINE_TIME_REQUIRED, DEADLINE_TIME_INVALID),
};

/**
 * The options – Hvornår? and Hvor? with "＋ Nyt sted": create, and edit
 * while nobody has voted (D-153). Their object-level checks are on
 * pollFormSchema below.
 */
const optionFields = {
  dates: datesField,
  startTime: timeField("Vælg et starttidspunkt.", "Skriv tiden som tt:mm, fx 18:30."),
  placeIds: idListSchema(MAX_POLL_PLACE_OPTIONS, {
    tooMany: PLACES_TOO_MANY,
    invalid: PLACES_INVALID,
  }),
  newPlace: checkboxSchema,
  // Required and ≤ 120 only when "＋ Nyt sted" is ticked (below).
  newPlaceName: z
    .string()
    .max(NEW_PLACE_NAME_RAW_MAX_LENGTH, NEW_PLACE_NAME_TOO_LONG)
    .nullish()
    .transform((value) => cleanPlaceName(value ?? "")),
  newPlaceAddress: z
    .string()
    .max(rawTextLimit(PLACE_ADDRESS_MAX_LENGTH), NEW_PLACE_ADDRESS_TOO_LONG)
    .nullish()
    .transform((value) => cleanOptionalText(value)),
  newPlaceMine: checkboxSchema,
};

const pollFieldsSchema = z.object({ ...textFields, ...optionFields, ...deadlineFields });

/** Runs an object-level check only when the fields it reads are valid (F-037). */
function whenValid<K extends keyof typeof pollFieldsSchema.shape>(...keys: K[]) {
  const mask = Object.fromEntries(keys.map((key) => [key, true])) as Partial<
    Record<keyof typeof pollFieldsSchema.shape, true>
  >;
  const picked = pollFieldsSchema.pick(mask);
  return (payload: { value: unknown }) => picked.safeParse(payload.value).success;
}

type PollFields = z.output<typeof pollFieldsSchema>;

const placeCount = (values: Pick<PollFields, "placeIds" | "newPlace">) =>
  values.placeIds.length + (values.newPlace ? 1 : 0);

const deadlineOf = (values: Pick<PollFields, "deadlineDate" | "deadlineTime">) =>
  zonedDateTimeToUtc(values.deadlineDate, values.deadlineTime);

/**
 * "Planlæg ølsmagning" (§9.7.1). The object-level checks – the new place, at
 * least one and at most 10 places with something to vote on (D-134), and the
 * deadline before the first date – also guard "Rediger" while nobody has
 * voted: pollEditSchema's options branch is this schema (D-153).
 */
export const pollFormSchema = pollFieldsSchema
  .superRefine(
    (values, ctx) => {
      if (!values.newPlace) return;
      if (values.newPlaceName === "") {
        ctx.addIssue({
          code: "custom",
          path: ["newPlaceName"],
          message: NEW_PLACE_NAME_REQUIRED_MESSAGE,
        });
      } else if (values.newPlaceName.length > PLACE_NAME_MAX_LENGTH) {
        ctx.addIssue({ code: "custom", path: ["newPlaceName"], message: NEW_PLACE_NAME_TOO_LONG });
      }
      if (
        values.newPlaceAddress !== null &&
        values.newPlaceAddress.length > PLACE_ADDRESS_MAX_LENGTH
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["newPlaceAddress"],
          message: NEW_PLACE_ADDRESS_TOO_LONG,
        });
      }
    },
    { when: whenValid("newPlace", "newPlaceName", "newPlaceAddress") },
  )
  .superRefine(
    (values, ctx) => {
      const places = placeCount(values);
      if (places === 0) {
        ctx.addIssue({ code: "custom", path: ["placeIds"], message: PLACES_REQUIRED });
      } else if (places > MAX_POLL_PLACE_OPTIONS) {
        ctx.addIssue({ code: "custom", path: ["placeIds"], message: PLACES_TOO_MANY });
      } else if (values.dates.length > 0 && !hasSomethingToVoteOn(values.dates.length, places)) {
        ctx.addIssue({ code: "custom", path: ["dates"], message: NOTHING_TO_VOTE_MESSAGE });
      }
    },
    { when: whenValid("dates", "placeIds", "newPlace") },
  )
  .superRefine(
    (values, ctx) => {
      const [first] = dateOptionInstants(values.dates, values.startTime);
      const deadline = deadlineOf(values);
      if (first && deadline && deadline.getTime() >= first.getTime()) {
        ctx.addIssue({
          code: "custom",
          path: ["deadlineDate"],
          message: deadlineBeforeFirstDateMessage(first),
        });
      }
    },
    { when: whenValid("dates", "startTime", "deadlineDate", "deadlineTime") },
  )
  .transform((values): PollFormData => {
    const newPlace = values.newPlace
      ? {
          name: values.newPlaceName,
          address: values.newPlaceAddress,
          ownedByCreator: values.newPlaceMine,
        }
      : null;
    return {
      title: values.title,
      theme: values.theme,
      description: values.description,
      dateStartsAt: dateOptionInstants(values.dates, values.startTime),
      places: { existingIds: values.placeIds, newPlace },
      // A valid date and time always convert (a gap time moves forward, D-069).
      deadline: deadlineOf(values) as Date,
    };
  });

/** The create form's raw values (as typed). */
export type PollFormInput = z.input<typeof pollFormSchema>;

/** "Rediger" once somebody has voted (D-133, E24): the texts and the deadline only. */
const pollEditTextsSchema = z
  .object({ ...textFields, ...deadlineFields })
  .transform((values): PollEditData => ({
    title: values.title,
    theme: values.theme,
    description: values.description,
    deadline: deadlineOf(values) as Date,
    options: null,
  }));

/** "Rediger" while nobody has voted (D-153): exactly the create form's fields and checks. */
const pollEditOptionsSchema = pollFormSchema.transform(
  ({ dateStartsAt, places, ...texts }): PollEditData => ({
    ...texts,
    options: { dateStartsAt, places },
  }),
);

/** The edit form's hidden "editOptions" field (a checkbox value, "1"). */
const editOptionsFlagSchema = z.object({ editOptions: checkboxSchema });

/**
 * "Rediger afstemning" (D-153). With editOptions set (the form shows the
 * date rows and the place picker because nobody has voted) the whole form is
 * parsed by pollFormSchema; without it only the texts and the deadline, and
 * `options` is null. Whether the poll really has no ballots, and whether the
 * deadline may move earlier, is decided by updatePoll under the poll lock.
 *
 * One schema for both, so the form engine and the action share it; the
 * chosen branch's issues are passed on with their paths and messages.
 */
export const pollEditSchema = z.unknown().transform((input, ctx): PollEditData => {
  const flag = editOptionsFlagSchema.safeParse(input);
  const schema =
    flag.success && flag.data.editOptions ? pollEditOptionsSchema : pollEditTextsSchema;
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
  return z.NEVER;
});

/** The edit form's raw values: the texts and the deadline, plus the options with editOptions. */
export type PollEditInput = z.input<typeof pollEditTextsSchema> &
  Partial<PollFormInput> & { editOptions?: string | boolean | null };

// ── Voting ──────────────────────────────────────────────────────────────────

const ballotFieldsSchema = z.object({
  dateOptionIds: idListSchema(MAX_POLL_DATE_OPTIONS, {
    tooMany: `Vælg højst ${MAX_POLL_DATE_OPTIONS} datoer.`,
    invalid: "Vælg datoer fra listen.",
  }),
  noDateWorks: checkboxSchema,
  placeOptionId: optionalId("Vælg et sted fra listen."),
});

/**
 * One ballot (§9.7.2): the ticked dates or «Ingen af datoerne passer mig», and
 * one place. Whether the ids belong to the poll, and whether a category is
 * fixed, is decided on the server (checkBallotChoice → ballotMessage).
 */
export const ballotSchema = ballotFieldsSchema
  .refine((values) => !(values.noDateWorks && values.dateOptionIds.length > 0), {
    message: DATE_AND_NONE_MESSAGE,
    path: ["dateOptionIds"],
    when: (payload) =>
      ballotFieldsSchema.pick({ dateOptionIds: true, noDateWorks: true }).safeParse(payload.value)
        .success,
  })
  .transform((values): BallotChoice => ({
    dateOptionIds: values.dateOptionIds,
    noDateWorks: values.noDateWorks,
    placeOptionId: values.placeOptionId,
  }));

export type BallotInput = z.input<typeof ballotSchema>;

/**
 * "Vælg vinder" after a tie (D-008): one radio group per tied category. A
 * missing group is simply not sent; the server answers invalid-choice for a
 * tied category without a choice (TIE_CHOICE_MESSAGES).
 */
export const tieChoiceSchema = z
  .object({
    dateOptionId: optionalId(TIE_CHOICE_MESSAGES.DATE),
    placeOptionId: optionalId(TIE_CHOICE_MESSAGES.PLACE),
  })
  .transform((values): Resolutions => {
    const resolutions: Resolutions = {};
    if (values.dateOptionId) resolutions.DATE = values.dateOptionId;
    if (values.placeOptionId) resolutions.PLACE = values.placeOptionId;
    return resolutions;
  });

export type TieChoiceInput = z.input<typeof tieChoiceSchema>;

// The schemas' outputs must stay exactly the contract types above.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _pollIsContract: Exact<z.output<typeof pollFormSchema>, PollFormData> = true;
const _editIsContract: Exact<z.output<typeof pollEditSchema>, PollEditData> = true;
const _ballotIsContract: Exact<z.output<typeof ballotSchema>, BallotChoice> = true;
const _tieIsContract: Exact<z.output<typeof tieChoiceSchema>, Resolutions> = true;
void _pollIsContract;
void _editIsContract;
void _ballotIsContract;
void _tieIsContract;
