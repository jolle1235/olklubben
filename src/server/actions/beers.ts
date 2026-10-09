"use server";

import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { beerHref, beersHref } from "@/lib/routes";
import { beerFormSchema, beerRefSchema } from "@/lib/validation/beer";
import { idSchema } from "@/lib/validation/id";
import { requireMembership } from "@/server/auth/session";
import { createBeer, deleteBeer, EventNotInClubError, updateBeer } from "@/server/beers/mutations";
import { findSimilarBeers, getBeer, type SimilarBeer } from "@/server/beers/queries";
import { isSameBeerName } from "@/server/domain/beers/name";
import { canAddBeer, canDeleteBeer, canEditBeer } from "@/server/domain/beers/permissions";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for the beer catalogue (SPEC §9.5, §5.1, D-063, §4.3):
 * Zod → requireMembership → load the beer in THIS club → can* check → write
 * → revalidate → redirect. Hidden buttons are only UX (§4.4).
 *
 * The form actions take FormData (useActionState), so the form also works
 * without JavaScript. Ids come from hidden fields and are untrusted:
 * malformed → 404, like a beer of another club (E22). Success redirects with
 * a `?toast=` flag (src/lib/flash-toast.ts), like the event actions.
 */

/** Echoed back so the form keeps what was typed after a failed submit. */
export type BeerFormValues = { name?: string; abv?: string; eventId?: string };

/**
 * null before the first submit. Success redirects, so only failures come back.
 * DUPLICATE_BEER carries the beers with the same name (E21): the form shows
 * them and lets the member add the beer anyway (confirmDuplicate).
 */
export type BeerFormState = {
  ok: false;
  error: ActionError;
  values: BeerFormValues;
  duplicates?: SimilarBeer[];
} | null;

const DUPLICATE_BEER_CODE = "DUPLICATE_BEER";
const EVENT_NOT_IN_CLUB_MESSAGE = "Vælg et event fra listen.";
const FORBIDDEN_EDIT_MESSAGE = "Kun den, der tilføjede øllen, og klubbens admins kan rette den.";
const FORBIDDEN_DELETE_MESSAGE = "Kun den, der tilføjede øllen, og klubbens admins kan slette den.";
const MAX_ECHO_LENGTH = 200;

function readString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function readBeerForm(formData: FormData) {
  const input = {
    name: readString(formData, "name"),
    abv: readString(formData, "abv"),
    eventId: readString(formData, "eventId"),
    confirmDuplicate: readString(formData, "confirmDuplicate"),
  };
  const values: BeerFormValues = {
    name: input.name?.slice(0, MAX_ECHO_LENGTH),
    abv: input.abv?.slice(0, MAX_ECHO_LENGTH),
    eventId: input.eventId?.slice(0, MAX_ECHO_LENGTH),
  };
  return { parsed: beerFormSchema.safeParse(input), values };
}

function failed(result: { ok: false; error: ActionError }, values: BeerFormValues): BeerFormState {
  return { ...result, values };
}

function eventNotInClub(values: BeerFormValues): BeerFormState {
  return failed(
    fail(ACTION_ERROR_CODES.VALIDATION, DEFAULT_ERROR_MESSAGES.VALIDATION, {
      eventId: [EVENT_NOT_IN_CLUB_MESSAGE],
    }),
    values,
  );
}

function duplicateWarning(values: BeerFormValues, duplicates: SimilarBeer[]): BeerFormState {
  return {
    ...fail(DUPLICATE_BEER_CODE, "Den her har I vist smagt før 👀"),
    values,
    duplicates,
  };
}

/**
 * The duplicate check (skipped when the member confirmed it, or for an
 * unchanged name), then the write. A failure is the form state to show.
 */
async function saveBeer<T>(
  values: BeerFormValues,
  findDuplicates: (() => Promise<SimilarBeer[]>) | null,
  write: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; state: BeerFormState }> {
  try {
    const duplicates = findDuplicates ? await findDuplicates() : [];
    if (duplicates.length > 0) return { ok: false, state: duplicateWarning(values, duplicates) };
    return { ok: true, result: await write() };
  } catch (error) {
    if (error instanceof EventNotInClubError) return { ok: false, state: eventNotInClub(values) };
    console.error("[beers] saving a beer failed", error);
    return { ok: false, state: failed(unexpectedError(), values) };
  }
}

/**
 * "Tilføj øl": adds a beer and opens its page, where the member rates it
 * (§10.5). Form fields: clubId, name, abv, eventId (optional), confirmDuplicate.
 */
export async function createBeerAction(
  _previous: BeerFormState,
  formData: FormData,
): Promise<BeerFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const { parsed, values } = readBeerForm(formData);
  if (!parsed.success) return failed(validationError(parsed.error), values);
  const { name, abv, eventId, confirmDuplicate } = parsed.data;

  const { user, membership, club } = await requireMembership(clubId.data);
  if (!canAddBeer(membership)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN), values);
  }

  const saved = await saveBeer(
    values,
    confirmDuplicate ? null : () => findSimilarBeers(club.id, name),
    () => createBeer({ clubId: club.id, createdById: user.id, name, abv, eventId }),
  );
  if (!saved.ok) return saved.state;

  revalidateClub(club.id);
  redirect(withToast(beerHref(club.id, saved.result.id), "beer-created"));
}

/**
 * "Rediger øl" (creator or admin, D-063). Form fields: clubId, beerId, name,
 * abv, eventId, confirmDuplicate. A new name that another beer of the club
 * already has gives the duplicate warning, like adding.
 */
export async function updateBeerAction(
  _previous: BeerFormState,
  formData: FormData,
): Promise<BeerFormState> {
  const ids = beerRefSchema.safeParse({
    clubId: formData.get("clubId"),
    beerId: formData.get("beerId"),
  });
  if (!ids.success) notFound();

  const { parsed, values } = readBeerForm(formData);
  if (!parsed.success) return failed(validationError(parsed.error), values);
  const { name, abv, eventId, confirmDuplicate } = parsed.data;

  const { user, membership, club } = await requireMembership(ids.data.clubId);
  const beer = await getBeer(club.id, ids.data.beerId, user.id);
  if (!beer) notFound();
  if (!canEditBeer(membership, beer, user.id)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_EDIT_MESSAGE), values);
  }

  const renamed = !isSameBeerName(name, beer.name);
  const saved = await saveBeer(
    values,
    confirmDuplicate || !renamed ? null : () => findSimilarBeers(club.id, name, beer.id),
    () => updateBeer({ clubId: club.id, beerId: beer.id, name, abv, eventId }),
  );
  if (!saved.ok) return saved.state;
  // Deleted by someone else meanwhile.
  if (!saved.result) notFound();

  revalidateClub(club.id);
  redirect(withToast(beerHref(club.id, beer.id), "beer-updated"));
}

/**
 * Deletes a beer with its ratings (E14, after a confirmation that shows how
 * many) and opens the catalogue with a toast. Creator or admin only.
 */
export async function deleteBeerAction(clubId: string, beerId: string): Promise<ActionResult> {
  const ids = beerRefSchema.safeParse({ clubId, beerId });
  if (!ids.success) notFound();

  const { user, membership, club } = await requireMembership(ids.data.clubId);
  const beer = await getBeer(club.id, ids.data.beerId, user.id);
  if (!beer) notFound();
  if (!canDeleteBeer(membership, beer, user.id)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_DELETE_MESSAGE);
  }

  let deleted: boolean;
  try {
    ({ deleted } = await deleteBeer({ clubId: club.id, beerId: beer.id }));
  } catch (error) {
    console.error("[beers] deleteBeer failed", error);
    return unexpectedError();
  }
  if (!deleted) notFound();

  // Redirect rather than return: a revalidated response re-renders the
  // current page, and the deleted beer's page would render a 404.
  revalidateClub(club.id);
  redirect(withToast(beersHref(club.id), "beer-deleted"));
}
