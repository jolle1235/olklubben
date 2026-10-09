"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { eventHref, overviewHref } from "@/lib/routes";
import { EVENT_ARRAY_FIELDS, eventFormSchema, type EventFormData } from "@/lib/validation/event";
import { idSchema } from "@/lib/validation/id";
import { requireMembership } from "@/server/auth/session";
import { MAX_EVENT_HOSTS } from "@/server/domain/events/hosts";
import { canCreateEvent, canDeleteEvent, canEditEvent } from "@/server/domain/events/permissions";
import {
  createEvent,
  deleteEvent,
  InvalidEventHostsError,
  PlaceNotSelectableError,
  updateEvent,
} from "@/server/events/mutations";
import { getEvent } from "@/server/events/queries";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for events (SPEC §4.3, §9.2, D-098, D-099).
 *
 * Every action re-checks on the server: ids (malformed → 404), the shared Zod
 * schema, membership (not a member → 404), the event in THIS club (→ 404,
 * E22) and canEditEvent/canDeleteEvent (creator, host or admin). Hidden
 * buttons are only UX (§4.4). The place and the hosts are decided by the data
 * layer under locks; its typed errors become field errors:
 *   PlaceNotSelectableError → placeId, InvalidEventHostsError → hostIds.
 * Another club's place gives the same "findes ikke længere" (no leak).
 *
 * Success redirects with a `?toast=` flag (src/lib/flash-toast.ts), so the forms also
 * work without JavaScript: create/update → the event page, delete → Overblik.
 */

const EVENT_TEXT_FIELDS = [
  "title",
  "date",
  "startTime",
  "endTime",
  "placeId",
  "newPlaceName",
  "newPlaceAddress",
  "newPlaceMine",
  "theme",
  "description",
] as const;

/** The form's field names (contract, D-099): texts plus the repeated hostIds. */
export type EventFormField = (typeof EVENT_TEXT_FIELDS)[number] | "hostIds";

/** What was typed, echoed back after a failed submit (React resets the uncontrolled form). */
export type EventFormValues = Partial<Record<(typeof EVENT_TEXT_FIELDS)[number], string>> & {
  hostIds?: string[];
};

/** The form state for useActionState: null before the first submit. Success redirects. */
export type EventFormState = FormFailure<EventFormValues> | null;

const NOT_ALLOWED_TO_EDIT = "Kun den, der oprettede eventet, og klubbens admins kan rette det.";
const NOT_ALLOWED_TO_DELETE = "Kun den, der oprettede eventet, og klubbens admins kan slette det.";

const PLACE_GONE_MESSAGE = "Stedet findes ikke længere. Vælg et andet.";
const PLACE_ARCHIVED_MESSAGE = "Stedet er arkiveret. Vælg et andet.";
const INVALID_HOSTS_MESSAGE = "Vælg værter blandt klubbens medlemmer.";

function readValues(formData: FormData): EventFormValues {
  const raw = readFormValues(formData, {
    arrays: EVENT_ARRAY_FIELDS,
    maxArrayLength: MAX_EVENT_HOSTS,
  });
  const values: EventFormValues = {};
  for (const field of EVENT_TEXT_FIELDS) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value;
  }
  if (Array.isArray(raw.hostIds)) values.hostIds = raw.hostIds;
  return values;
}

function failed(
  result: { ok: false; error: ActionError },
  values: EventFormValues,
): FormFailure<EventFormValues> {
  return { ...result, values };
}

function fieldFailure(field: EventFormField, message: string, values: EventFormValues) {
  return failed(
    fail(ACTION_ERROR_CODES.VALIDATION, DEFAULT_ERROR_MESSAGES.VALIDATION, { [field]: [message] }),
    values,
  );
}

/** The data layer's typed errors as the form's next state; anything else → the generic error. */
function writeFailure(error: unknown, values: EventFormValues, label: string): EventFormState {
  if (error instanceof PlaceNotSelectableError) {
    return fieldFailure(
      "placeId",
      error.reason === "ARCHIVED" ? PLACE_ARCHIVED_MESSAGE : PLACE_GONE_MESSAGE,
      values,
    );
  }
  if (error instanceof InvalidEventHostsError) {
    return fieldFailure("hostIds", INVALID_HOSTS_MESSAGE, values);
  }
  console.error(`[events] ${label} failed`, error);
  return failed(unexpectedError(), values);
}

/** The shared Zod schema (SPEC §9.2); a failure is the form's next state. */
function parseEventForm(
  formData: FormData,
):
  | { ok: true; data: EventFormData; values: EventFormValues }
  | { ok: false; state: FormFailure<EventFormValues> } {
  const values = readValues(formData);
  const parsed = eventFormSchema.safeParse(values);
  return parsed.success
    ? { ok: true, data: parsed.data, values }
    : { ok: false, state: failed(validationError(parsed.error), values) };
}

/**
 * "Opret event" (SPEC §10.4). Form fields: clubId (hidden), title, date,
 * startTime, endTime, placeId ("new" for "＋ Nyt sted" with newPlaceName,
 * newPlaceAddress, newPlaceMine), hostIds[] (empty = default), theme,
 * description. Opens the new event.
 */
export async function createEventAction(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const form = parseEventForm(formData);
  if (!form.ok) return form.state;

  const { user, membership, club } = await requireMembership(clubId.data);
  if (!canCreateEvent(membership)) {
    return failed(
      fail(ACTION_ERROR_CODES.FORBIDDEN, "Kun medlemmer kan oprette events."),
      form.values,
    );
  }

  let eventId: string;
  try {
    ({ id: eventId } = await createEvent({ clubId: club.id, createdById: user.id, ...form.data }));
  } catch (error) {
    return writeFailure(error, form.values, "createEvent");
  }

  revalidateClub(club.id);
  redirect(withToast(eventHref(club.id, eventId), "event-created"));
}

/**
 * "Gem ændringer" on the edit page. Creator, host or admin (D-098). Same
 * fields as create, plus eventId (hidden).
 */
export async function updateEventAction(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const ids = z
    .object({ clubId: idSchema, eventId: idSchema })
    .safeParse({ clubId: formData.get("clubId"), eventId: formData.get("eventId") });
  if (!ids.success) notFound();

  const form = parseEventForm(formData);
  if (!form.ok) return form.state;

  const { user, membership, club } = await requireMembership(ids.data.clubId);
  const event = await getEvent(club.id, ids.data.eventId);
  if (!event) notFound();
  if (!canEditEvent(membership, event, user.id)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_EDIT), form.values);
  }

  let updated: boolean;
  try {
    updated = await updateEvent({
      clubId: club.id,
      eventId: event.id,
      actorUserId: user.id,
      ...form.data,
    });
  } catch (error) {
    return writeFailure(error, form.values, "updateEvent");
  }
  // Deleted by someone else in the meantime.
  if (!updated) notFound();

  revalidateClub(club.id);
  redirect(withToast(eventHref(club.id, event.id), "event-updated"));
}

/**
 * "Slet event" after the confirmation (SPEC §9.2). Creator, host or admin. The
 * event's beers stay in the catalogue without the link, ratings included
 * (E13). Opens Overblik, whose toast says so.
 */
export async function deleteEventAction(clubId: string, eventId: string): Promise<ActionResult> {
  const ids = z.object({ clubId: idSchema, eventId: idSchema }).safeParse({ clubId, eventId });
  if (!ids.success) notFound();

  const { user, membership, club } = await requireMembership(ids.data.clubId);
  const event = await getEvent(club.id, ids.data.eventId);
  if (!event) notFound();
  if (!canDeleteEvent(membership, event, user.id)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_DELETE);
  }

  let detachedBeerCount: number;
  try {
    ({ detachedBeerCount } = await deleteEvent({ clubId: club.id, eventId: event.id }));
  } catch (error) {
    console.error("[events] deleteEvent failed", error);
    return unexpectedError();
  }

  revalidateClub(club.id);
  redirect(
    withToast(
      overviewHref(club.id),
      detachedBeerCount > 0 ? "event-deleted-beers-kept" : "event-deleted",
    ),
  );
}
