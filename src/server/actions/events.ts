"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTION_ERROR_CODES,
  fail,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { eventHref, overviewHref } from "@/lib/routes";
import { eventFormSchema, type EventFormData } from "@/lib/validation/event";
import { idSchema } from "@/lib/validation/id";
import { requireMembership } from "@/server/auth/session";
import { canCreateEvent, canDeleteEvent, canEditEvent } from "@/server/domain/events/permissions";
import { createEvent, deleteEvent, updateEvent } from "@/server/events/mutations";
import { getEvent } from "@/server/events/queries";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for events (SPEC §4.3, §9.2, D-061).
 *
 * Every action re-checks on the server: ids (malformed → 404), the shared Zod
 * schema, membership (not a member → 404), the event in THIS club (→ 404,
 * E22) and canEditEvent/canDeleteEvent (creator or admin). Hidden buttons are
 * only UX (§4.4).
 *
 * Success redirects with a `?toast=` flag (src/lib/flash-toast.ts), so the forms also
 * work without JavaScript: create/update → the event page, delete → Overblik.
 */

const EVENT_FIELDS = [
  "title",
  "date",
  "startTime",
  "endTime",
  "locationText",
  "theme",
  "description",
] as const;

export type EventFormField = (typeof EVENT_FIELDS)[number];

/** What was typed, echoed back after a failed submit (React resets the uncontrolled form). */
export type EventFormValues = Partial<Record<EventFormField, string>>;

/** The form state for useActionState: null before the first submit. Success redirects. */
export type EventFormState = { ok: false; error: ActionError; values: EventFormValues } | null;

const NOT_ALLOWED_TO_EDIT = "Kun den, der oprettede eventet, og klubbens admins kan rette det.";
const NOT_ALLOWED_TO_DELETE = "Kun den, der oprettede eventet, og klubbens admins kan slette det.";

function readValues(formData: FormData): EventFormValues {
  const values: EventFormValues = {};
  for (const field of EVENT_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

function failed(
  result: { ok: false; error: ActionError },
  values: EventFormValues,
): NonNullable<EventFormState> {
  return { ...result, values };
}

/** The shared Zod schema (SPEC §9.2); a failure is the form's next state. */
function parseEventForm(
  formData: FormData,
):
  | { ok: true; data: EventFormData; values: EventFormValues }
  | { ok: false; state: NonNullable<EventFormState> } {
  const values = readValues(formData);
  const parsed = eventFormSchema.safeParse(values);
  return parsed.success
    ? { ok: true, data: parsed.data, values }
    : { ok: false, state: failed(validationError(parsed.error), values) };
}

/**
 * "Opret event" (SPEC §10.4). Form fields: clubId (hidden), title, date,
 * startTime, endTime, locationText, theme, description. Opens the new event.
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
    console.error("[events] createEvent failed", error);
    return failed(unexpectedError(), form.values);
  }

  revalidateClub(club.id);
  redirect(withToast(eventHref(club.id, eventId), "event-created"));
}

/**
 * "Gem ændringer" on the edit page. Creator or admin only (D-061). Same
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
    updated = await updateEvent({ clubId: club.id, eventId: event.id, ...form.data });
  } catch (error) {
    console.error("[events] updateEvent failed", error);
    return failed(unexpectedError(), form.values);
  }
  // Deleted by someone else in the meantime.
  if (!updated) notFound();

  revalidateClub(club.id);
  redirect(withToast(eventHref(club.id, event.id), "event-updated"));
}

/**
 * "Slet event" after the confirmation (SPEC §9.2). Creator or admin only. The
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
