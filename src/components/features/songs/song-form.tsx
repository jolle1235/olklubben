"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowRightIcon, EyeIcon } from "lucide-react";

import { FieldShell, InputField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { songHref } from "@/lib/routes";
import { songFormSchema } from "@/lib/validation/song";
import { createSongAction, updateSongAction, type SongFormState } from "@/server/actions/songs";
import { cleanSongText } from "@/server/domain/songs/song-text";
import {
  SONG_ARTIST_MAX_LENGTH,
  SONG_MELODY_MAX_LENGTH,
  SONG_TITLE_MAX_LENGTH,
} from "@/server/domain/songs/title";

import { SongFormatHelp } from "./song-format-help";
import { SongPreview } from "./song-preview";
import { useHydrated } from "./use-songbook-prefs";

/** The fields' starting values ("" for empty). */
export type SongFormDefaults = { title: string; artist: string; melody: string; body: string };

export type SongFormProps = {
  clubId: string;
  /** Set when editing; otherwise the form adds a song. */
  songId?: string;
  defaults: SongFormDefaults;
  /** "Annuller": the songbook when adding, the song when editing. */
  cancelHref: string;
};

/**
 * Add or edit a song (SPEC §9.6, admins only, §5.1): title, artist, melody
 * and "Tekst og akkorder" in the song-text format. The text field is
 * monospace and never wraps, so chord columns stay true; "Forhåndsvis" shows
 * exactly how each line is read (the reader's chords view).
 *
 * Validated with the shared Zod schema in the browser and again in the Server
 * Action (useActionForm). A title another song already has comes back as the
 * title's error with a link to that song. Works without JavaScript (only the
 * preview needs it).
 */
export function SongForm({ clubId, songId, defaults, cancelHref }: SongFormProps) {
  const editing = songId !== undefined;
  const { state, formProps, fieldErrors, formError, serverError, values } =
    useActionForm<SongFormState>(editing ? updateSongAction : createSongAction, {
      schema: songFormSchema,
    });
  const initial = (field: keyof SongFormDefaults) => values[field] ?? defaults[field];
  const titleTaken = serverError?.code === ACTION_ERROR_CODES.SONG_TITLE_TAKEN;
  const existing = titleTaken && state && !state.ok ? state.existing : undefined;

  const hydrated = useHydrated();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  // The text as it was when "Forhåndsvis" was pressed; null = editing.
  const [preview, setPreview] = useState<string | null>(null);
  // An error in the text always shows the field itself.
  const previewing = preview !== null && !fieldErrors.body;
  const previewBody = previewing ? cleanSongText(preview) : "";

  function togglePreview() {
    if (previewing) {
      setPreview(null);
      requestAnimationFrame(() => bodyRef.current?.focus());
    } else {
      setPreview(bodyRef.current?.value ?? "");
      requestAnimationFrame(() => editRef.current?.focus());
    }
  }

  return (
    <form
      {...formProps}
      onSubmit={(event) => {
        // Back to the field first, so a text error can focus it.
        if (preview !== null) flushSync(() => setPreview(null));
        formProps.onSubmit(event);
      }}
      className="grid gap-6"
    >
      <input type="hidden" name="clubId" value={clubId} />
      {editing ? <input type="hidden" name="songId" value={songId} /> : null}

      {formError ? <FormError>{formError.message}</FormError> : null}

      <div className="grid gap-2">
        <InputField
          name="title"
          label="Titel"
          defaultValue={initial("title")}
          maxLength={SONG_TITLE_MAX_LENGTH}
          autoComplete="off"
          required
          errors={fieldErrors.title}
        />
        {existing ? (
          <Link
            href={songHref(clubId, existing.id)}
            className="inline-flex min-h-11 w-fit max-w-full items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
          >
            <span className="min-w-0 break-words hyphens-auto">Gå til «{existing.title}»</span>
            <ArrowRightIcon aria-hidden className="size-4 shrink-0" />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <InputField
          name="artist"
          label="Kunstner"
          optional="valgfri"
          defaultValue={initial("artist")}
          maxLength={SONG_ARTIST_MAX_LENGTH}
          autoComplete="off"
          errors={fieldErrors.artist}
          hint="Den, der synger den originale version, fx Kim Larsen."
        />
        <InputField
          name="melody"
          label="Melodi"
          optional="valgfri"
          defaultValue={initial("melody")}
          maxLength={SONG_MELODY_MAX_LENGTH}
          autoComplete="off"
          errors={fieldErrors.melody}
          hint="Hvis sangen synges på en kendt melodi, fx Den gamle skibsklokke. Vises som «Mel.: …»."
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className={previewing ? "hidden" : "grid grid-cols-1"}>
          <FieldShell label="Tekst og akkorder" errors={fieldErrors.body}>
            {(control) => (
              <Textarea
                {...control}
                ref={bodyRef}
                name="body"
                defaultValue={initial("body")}
                rows={18}
                wrap="off"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                required
                className="field-sizing-fixed resize-y overflow-x-auto font-mono text-[0.95rem] leading-relaxed whitespace-pre"
              />
            )}
          </FieldShell>
        </div>
        {previewing ? (
          <SongPreview body={previewBody} onEdit={togglePreview} editRef={editRef} />
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!hydrated}
            onClick={togglePreview}
            className="justify-self-start"
          >
            <EyeIcon aria-hidden />
            Forhåndsvis
          </Button>
        )}
        <SongFormatHelp />
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <SubmitButton size="lg" pendingLabel={editing ? "Gemmer …" : "Tilføjer sangen …"}>
          {editing ? "Gem" : "Tilføj sang"}
        </SubmitButton>
        <Button asChild variant="outline" size="lg">
          <Link href={cancelHref}>Annuller</Link>
        </Button>
      </div>
    </form>
  );
}
