"use server";

import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  fail,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { songHref, songsHref } from "@/lib/routes";
import { idSchema } from "@/lib/validation/id";
import { songFieldsSchema, songRefSchema } from "@/lib/validation/song";
import { requireMembership } from "@/server/auth/session";
import { canManageSongs, SONGS_FORBIDDEN_MESSAGE } from "@/server/domain/songs/permissions";
import { revalidateClub } from "@/server/revalidate";
import { requireSong } from "@/server/songs/access";
import { createSong, deleteSong, SongTitleTakenError, updateSong } from "@/server/songs/mutations";

/**
 * Server Actions for the songbook (SPEC §9.6, §5.1, §4.3): admins add, edit
 * and delete songs; members only read.
 *
 * Every action re-checks on the server, in this order: ids (malformed → 404),
 * the shared Zod schema, membership and the song in THIS club (requireSong:
 * → 404, E22), canManageSongs, then the data layer. Hidden buttons are only
 * UX (§4.4).
 *
 * The form takes FormData (useActionState), so it works without JavaScript;
 * success redirects with a `?toast=` flag. Delete redirects to the list.
 */

const SONG_TEXT_FIELDS = ["title", "artist", "melody", "body"] as const;

/** What was typed, echoed back after a failed submit (React resets the uncontrolled form). */
export type SongFormValues = Partial<Record<(typeof SONG_TEXT_FIELDS)[number], string>>;

/** The song that already has the title (SONG_TITLE_TAKEN), so the form can link to it. */
export type ExistingSong = { id: string; title: string };

/** null before the first submit. Success redirects, so only failures come back. */
export type SongFormState = (FormFailure<SongFormValues> & { existing?: ExistingSong }) | null;

/**
 * Generous: a too long text must come back whole, so the admin can shorten it
 * (the body's raw cap is 80,000; the schema refuses more before cleaning).
 */
const MAX_ECHO_LENGTH = 80_000;

function readValues(formData: FormData): SongFormValues {
  const raw = readFormValues(formData);
  const values: SongFormValues = {};
  for (const field of SONG_TEXT_FIELDS) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHO_LENGTH);
  }
  return values;
}

function failed(
  result: { ok: false; error: ActionError },
  values: SongFormValues,
): FormFailure<SongFormValues> {
  return { ...result, values };
}

function forbidden(values: SongFormValues): SongFormState {
  return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, SONGS_FORBIDDEN_MESSAGE), values);
}

/** SongTitleTakenError → the title field's error, plus the existing song for a link. */
function writeFailure(error: unknown, values: SongFormValues, label: string): SongFormState {
  if (error instanceof SongTitleTakenError) {
    return {
      ...fail(ACTION_ERROR_CODES.SONG_TITLE_TAKEN, error.message, { title: [error.message] }),
      values,
      existing: error.existing,
    };
  }
  console.error(`[songs] ${label} failed`, error);
  return failed(unexpectedError(), values);
}

/**
 * "Tilføj sang" (admins). Form fields: clubId (hidden), title, artist,
 * melody, body. Opens the new song in the reader.
 */
export async function createSongAction(
  _previous: SongFormState,
  formData: FormData,
): Promise<SongFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const values = readValues(formData);
  const parsed = songFieldsSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { user, membership, club } = await requireMembership(clubId.data);
  if (!canManageSongs(membership)) return forbidden(values);

  let songId: string;
  try {
    ({ id: songId } = await createSong({ clubId: club.id, createdById: user.id, ...parsed.data }));
  } catch (error) {
    return writeFailure(error, values, "createSong");
  }

  revalidateClub(club.id);
  redirect(withToast(songHref(club.id, songId), "song-created"));
}

/**
 * "Gem" on the edit page (admins). Form fields: clubId, songId (hidden),
 * title, artist, melody, body. Never touches the import provenance.
 */
export async function updateSongAction(
  _previous: SongFormState,
  formData: FormData,
): Promise<SongFormState> {
  const ids = songRefSchema.safeParse({
    clubId: formData.get("clubId"),
    songId: formData.get("songId"),
  });
  if (!ids.success) notFound();

  const values = readValues(formData);
  const parsed = songFieldsSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { membership, club, song } = await requireSong(ids.data.clubId, ids.data.songId);
  if (!canManageSongs(membership)) return forbidden(values);

  let updated: boolean;
  try {
    updated = await updateSong({ clubId: club.id, songId: song.id, ...parsed.data });
  } catch (error) {
    return writeFailure(error, values, "updateSong");
  }
  // Deleted by another admin in the meantime.
  if (!updated) notFound();

  revalidateClub(club.id);
  redirect(withToast(songHref(club.id, song.id), "song-updated"));
}

/** "Slet sang" on the reader page (admins, after the ConfirmDialog). → Sangbogen. */
export async function deleteSongAction(clubId: string, songId: string): Promise<ActionResult> {
  const ids = songRefSchema.safeParse({ clubId, songId });
  if (!ids.success) notFound();

  const { membership, club, song } = await requireSong(ids.data.clubId, ids.data.songId);
  if (!canManageSongs(membership))
    return fail(ACTION_ERROR_CODES.FORBIDDEN, SONGS_FORBIDDEN_MESSAGE);

  let deleted: boolean;
  try {
    deleted = await deleteSong({ clubId: club.id, songId: song.id });
  } catch (error) {
    console.error("[songs] deleteSong failed", error);
    return unexpectedError();
  }
  if (!deleted) notFound();

  // Redirect rather than return: the deleted song's page would render a 404.
  revalidateClub(club.id);
  redirect(withToast(songsHref(club.id), "song-deleted"));
}
