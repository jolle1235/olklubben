"use server";

import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  ok,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { placeHref, placesHref } from "@/lib/routes";
import { idSchema } from "@/lib/validation/id";
import {
  createPlaceSchema,
  ownPlaceOwnershipSchema,
  placeFieldsSchema,
  placeOwnerRefSchema,
  placeRefSchema,
} from "@/lib/validation/place";
import { requireMembership } from "@/server/auth/session";
import {
  canCreatePlace,
  canEditPlace,
  canRemovePlace,
  canRemovePlaceOwner,
  canRestorePlace,
  canSetOwnOwnership,
  placeRemoval,
  placeRemovalBlock,
} from "@/server/domain/places/permissions";
import {
  createPlace,
  PlaceNameTakenError,
  removePlace,
  restorePlace,
  setPlaceOwnership,
  updatePlace,
} from "@/server/places/mutations";
import { requirePlace } from "@/server/places/access";
import { placeUsageOf } from "@/server/places/queries";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for places (SPEC §9.4, §5.1, §4.3, D-095, D-100).
 *
 * Every action re-checks on the server, in this order: ids (malformed → 404),
 * the shared Zod schema, membership and the place in THIS club (requirePlace:
 * → 404, E22), the can* rule, then the data layer. Hidden buttons are
 * only UX (§4.4). The owner toggle only ever changes the CALLER's ownership:
 * it takes no user id at all.
 *
 * The forms take FormData (useActionState), so they work without JavaScript;
 * success redirects with a `?toast=` flag. "Det er mit sted" and removing an
 * owner return a result instead (they stay on the page, optimistic UI).
 */

const PLACE_TEXT_FIELDS = ["name", "address", "description", "makeMeOwner"] as const;

/** What was typed, echoed back after a failed submit (React resets the uncontrolled form). */
export type PlaceFormValues = Partial<Record<(typeof PLACE_TEXT_FIELDS)[number], string>>;

/** The place that already has the name (PLACE_NAME_TAKEN), so the form can link to it. */
export type ExistingPlace = { id: string; name: string };

/** null before the first submit. Success redirects, so only failures come back. */
export type PlaceFormState = (FormFailure<PlaceFormValues> & { existing?: ExistingPlace }) | null;

/** "Gendan sted": success redirects; a name clash links to the active place with the name. */
export type RestorePlaceState = { ok: false; error: ActionError; existing?: ExistingPlace } | null;

/** Generous: a too long text must come back whole, so the member can shorten it (D-090 caps parse). */
const MAX_ECHO_LENGTH = 5000;

const FORBIDDEN_ARCHIVE = "Kun stedets ejere og klubbens admins kan arkivere det.";
const FORBIDDEN_DELETE = "Kun stedets ejere, opretteren og klubbens admins kan slette det.";
const FORBIDDEN_RESTORE = "Kun stedets ejere og klubbens admins kan gendanne det.";
const FORBIDDEN_REMOVE_OWNER = "Kun klubbens admins kan fjerne andre som ejere.";

/** E5 (D-132): the place is an option in a poll that is not finished. */
function placeInActivePollError(pollTitle: string): string {
  return `Stedet er med i afstemningen «${pollTitle}», så det kan ikke fjernes, før afstemningen er afsluttet eller annulleret.`;
}

function restoreNameTakenMessage(name: string): string {
  return `Der findes allerede et aktivt sted, der hedder «${name}».`;
}

function readValues(formData: FormData): PlaceFormValues {
  const raw = readFormValues(formData);
  const values: PlaceFormValues = {};
  for (const field of PLACE_TEXT_FIELDS) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHO_LENGTH);
  }
  return values;
}

function failed(
  result: { ok: false; error: ActionError },
  values: PlaceFormValues,
): FormFailure<PlaceFormValues> {
  return { ...result, values };
}

/** PlaceNameTakenError → the name field's error, plus the existing place for a link. */
function nameTaken(error: PlaceNameTakenError, values: PlaceFormValues): PlaceFormState {
  return {
    ...fail(ACTION_ERROR_CODES.PLACE_NAME_TAKEN, error.message, { name: [error.message] }),
    values,
    existing: error.existing,
  };
}

function writeFailure(error: unknown, values: PlaceFormValues, label: string): PlaceFormState {
  if (error instanceof PlaceNameTakenError) return nameTaken(error, values);
  console.error(`[places] ${label} failed`, error);
  return failed(unexpectedError(), values);
}

/**
 * "Opret sted" (SPEC §9.4). Form fields: clubId (hidden), name, address,
 * description, makeMeOwner ("Det er mit sted"). Opens the new place.
 */
export async function createPlaceAction(
  _previous: PlaceFormState,
  formData: FormData,
): Promise<PlaceFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const values = readValues(formData);
  const parsed = createPlaceSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { user, membership, club } = await requireMembership(clubId.data);
  if (!canCreatePlace(membership)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN), values);
  }

  let placeId: string;
  try {
    ({ id: placeId } = await createPlace({
      clubId: club.id,
      createdById: user.id,
      name: parsed.data.name,
      address: parsed.data.address,
      description: parsed.data.description,
      makeCreatorOwner: parsed.data.makeMeOwner,
    }));
  } catch (error) {
    return writeFailure(error, values, "createPlace");
  }

  revalidateClub(club.id);
  redirect(withToast(placeHref(club.id, placeId), "place-created"));
}

/**
 * "Gem ændringer" on the edit page: name, address and description. Every
 * member, archived places too (§9.4). Form fields: clubId, placeId (hidden),
 * name, address, description.
 */
export async function updatePlaceAction(
  _previous: PlaceFormState,
  formData: FormData,
): Promise<PlaceFormState> {
  const ids = placeRefSchema.safeParse({
    clubId: formData.get("clubId"),
    placeId: formData.get("placeId"),
  });
  if (!ids.success) notFound();

  const values = readValues(formData);
  const parsed = placeFieldsSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { membership, club, place } = await requirePlace(ids.data.clubId, ids.data.placeId);
  if (!canEditPlace(membership)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN), values);
  }

  let updated: boolean;
  try {
    updated = await updatePlace({ clubId: club.id, placeId: place.id, ...parsed.data });
  } catch (error) {
    return writeFailure(error, values, "updatePlace");
  }
  // Deleted by someone else in the meantime.
  if (!updated) notFound();

  revalidateClub(club.id);
  redirect(withToast(placeHref(club.id, place.id), "place-updated"));
}

/**
 * "Det er mit sted" / "Fjern mig som ejer" (§9.4): sets the CALLER's
 * ownership to the desired state (a double tap is harmless). Optimistic in the
 * UI; returns the new state.
 */
export async function setOwnPlaceOwnershipAction(
  clubId: string,
  placeId: string,
  owned: boolean,
): Promise<ActionResult<{ isOwner: boolean }>> {
  const ids = placeRefSchema.safeParse({ clubId, placeId });
  if (!ids.success) notFound();
  const parsed = ownPlaceOwnershipSchema.safeParse({ ...ids.data, owned });
  if (!parsed.success) return validationError(parsed.error);

  const { user, membership, club, place } = await requirePlace(ids.data.clubId, ids.data.placeId);
  if (!canSetOwnOwnership(membership)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN);
  }

  let result: "ok" | "not-found";
  try {
    result = await setPlaceOwnership({
      clubId: club.id,
      placeId: place.id,
      userId: user.id,
      owned: parsed.data.owned,
    });
  } catch (error) {
    console.error("[places] setPlaceOwnership failed", error);
    return unexpectedError();
  }
  // The place was deleted (or the caller removed from the club) meanwhile.
  if (result === "not-found") notFound();

  revalidateClub(club.id);
  return ok({ isOwner: parsed.data.owned });
}

/**
 * An admin removes ANOTHER owner (clean-up, §5.1 note). Yourself works too,
 * like the toggle. Removing someone who is not an owner is a no-op.
 */
export async function removePlaceOwnerAction(
  clubId: string,
  placeId: string,
  userId: string,
): Promise<ActionResult> {
  const ids = placeOwnerRefSchema.safeParse({ clubId, placeId, userId });
  if (!ids.success) notFound();

  const { user, membership, club, place } = await requirePlace(ids.data.clubId, ids.data.placeId);
  if (!canRemovePlaceOwner(membership, user.id, ids.data.userId)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_REMOVE_OWNER);
  }

  try {
    await setPlaceOwnership({
      clubId: club.id,
      placeId: place.id,
      userId: ids.data.userId,
      owned: false,
    });
  } catch (error) {
    console.error("[places] removing an owner failed", error);
    return unexpectedError();
  }

  revalidateClub(club.id);
  return ok();
}

/**
 * The one removal button (D-100): an unused place is deleted (→ Steder), a
 * used one archived (→ the place, with its banner). The data layer decides
 * again under the place's row lock, so the toast follows what actually
 * happened. Already archived (by someone else) → the place, as archived.
 */
export async function removePlaceAction(clubId: string, placeId: string): Promise<ActionResult> {
  const ids = placeRefSchema.safeParse({ clubId, placeId });
  if (!ids.success) notFound();

  const { user, membership, club, place } = await requirePlace(ids.data.clubId, ids.data.placeId);
  if (place.archivedAt !== null) {
    redirect(withToast(placeHref(club.id, place.id), "place-archived"));
  }
  const usage = placeUsageOf(place);
  const [activePoll] = place.activePolls;
  if (placeRemovalBlock(usage) !== null && activePoll) {
    return fail(ACTION_ERROR_CODES.CONFLICT, placeInActivePollError(activePoll.title));
  }
  const forbiddenMessage = placeRemoval(usage) === "archive" ? FORBIDDEN_ARCHIVE : FORBIDDEN_DELETE;
  if (!canRemovePlace(membership, place, user.id, usage)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, forbiddenMessage);
  }

  let result: Awaited<ReturnType<typeof removePlace>>;
  try {
    result = await removePlace({
      clubId: club.id,
      placeId: place.id,
      actorUserId: user.id,
      actorRole: membership.role,
    });
  } catch (error) {
    console.error("[places] removePlace failed", error);
    return unexpectedError();
  }

  const { status } = result;
  if (status === "not-found") notFound();
  // E5: a poll chose the place meanwhile.
  if (result.status === "in-active-poll") {
    return fail(ACTION_ERROR_CODES.CONFLICT, placeInActivePollError(result.poll.title));
  }
  // Became used meanwhile and the caller is only its creator, for instance.
  if (status === "forbidden") return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_ARCHIVE);

  revalidateClub(club.id);
  // Redirect rather than return: a deleted place's page would render a 404.
  if (status === "deleted") redirect(withToast(placesHref(club.id), "place-deleted"));
  redirect(withToast(placeHref(club.id, place.id), "place-archived"));
}

/**
 * "Gendan sted" (owner or admin): the place is offered again when choosing a
 * place. Refused when an active place has taken its name meanwhile. Bind
 * clubId and placeId; works as a form action (useActionState) without JS.
 */
export async function restorePlaceAction(
  clubId: string,
  placeId: string,
): Promise<RestorePlaceState> {
  const ids = placeRefSchema.safeParse({ clubId, placeId });
  if (!ids.success) notFound();

  const { user, membership, club, place } = await requirePlace(ids.data.clubId, ids.data.placeId);
  // Restored by someone else meanwhile: nothing to do.
  if (place.archivedAt === null) redirect(placeHref(club.id, place.id));
  if (!canRestorePlace(membership, place, user.id)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_RESTORE);
  }

  let result: Awaited<ReturnType<typeof restorePlace>>;
  try {
    result = await restorePlace({ clubId: club.id, placeId: place.id });
  } catch (error) {
    if (error instanceof PlaceNameTakenError) {
      return {
        ...fail(ACTION_ERROR_CODES.PLACE_NAME_TAKEN, restoreNameTakenMessage(error.existing.name)),
        existing: error.existing,
      };
    }
    console.error("[places] restorePlace failed", error);
    return unexpectedError();
  }
  if (result === "not-found") notFound();

  revalidateClub(club.id);
  redirect(withToast(placeHref(club.id, place.id), "place-restored"));
}
