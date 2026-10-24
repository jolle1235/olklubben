import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, Loader2Icon, Trash2Icon } from "lucide-react";

import { FieldShell, InputField } from "@/components/features/forms/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/action-result";
import { songHref } from "@/lib/routes";
import { cleanSongText } from "@/server/domain/songs/song-text";
import {
  SONG_ARTIST_MAX_LENGTH,
  SONG_MELODY_MAX_LENGTH,
  SONG_TITLE_MAX_LENGTH,
  songTitleKey,
} from "@/server/domain/songs/title";
import { cn } from "@/lib/utils";

import { SongFormatHelp } from "./song-format-help";
import { SongTextView } from "./song-text-view";
import {
  validateDraft,
  type DraftFields,
  type ImportItem,
  type ReadyItem,
} from "./use-song-pdf-import";

/**
 * One file in the PDF import's list (SPEC §9.6, D-156): still reading, failed
 * (with [Fjern]), or a draft in review with its checkbox, kind, problems,
 * notes and [Vis og ret], which opens the song form's fields.
 */

export function ImportRow({
  clubId,
  item,
  duplicate,
  onChange,
  onRemove,
}: {
  clubId: string;
  item: ImportItem;
  duplicate: boolean;
  onChange: (change: (item: ReadyItem) => ReadyItem) => void;
  onRemove: () => void;
}) {
  if (item.phase !== "ready") {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-border bg-paper px-4 py-3">
        {item.phase === "reading" ? (
          <Loader2Icon aria-hidden className="size-5 shrink-0 animate-spin text-slate" />
        ) : null}
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-semibold text-ink">{item.fileName}</span>
          <span
            className={cn("text-[0.95rem]", item.phase === "failed" ? "text-danger" : "text-slate")}
          >
            {item.phase === "failed" ? item.error : "Læser …"}
          </span>
        </div>
        {item.phase === "failed" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Fjern ${item.fileName}`}
          >
            <Trash2Icon aria-hidden />
          </Button>
        ) : null}
      </li>
    );
  }
  return (
    <ReviewRow
      clubId={clubId}
      item={item}
      duplicate={duplicate}
      onChange={onChange}
      onRemove={onRemove}
    />
  );
}

/** Why the draft cannot be imported as it is, or null. */
function draftProblem(item: ReadyItem, errors: FieldErrors | null, duplicate: boolean) {
  const { candidate, fields } = item;
  if (errors) return "Ret felterne, før sangen kan importeres.";
  if (candidate.status === "imported") return "Filen er importeret før.";
  if (
    candidate.status === "title-taken" &&
    songTitleKey(fields.title) === songTitleKey(candidate.title)
  ) {
    return "Titlen findes allerede i sangbogen. Giv den en anden titel for at importere den.";
  }
  return duplicate ? "En anden af de valgte sange hedder det samme." : null;
}

function ReviewRow({
  clubId,
  item,
  duplicate,
  onChange,
  onRemove,
}: {
  clubId: string;
  item: ReadyItem;
  duplicate: boolean;
  onChange: (change: (item: ReadyItem) => ReadyItem) => void;
  onRemove: () => void;
}) {
  const { candidate, fields } = item;
  const errors = validateDraft(fields);
  const problem = draftProblem(item, errors, duplicate);
  const checkboxId = `song-import-${item.key}`;

  return (
    <li className="grid gap-3 rounded-xl border border-border bg-paper px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={item.selected && !errors}
          disabled={Boolean(errors)}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            onChange((current) => ({ ...current, selected: checked }));
          }}
          className="mt-1 size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <label htmlFor={checkboxId} className="cursor-pointer font-semibold break-words text-ink">
            {fields.title || "(uden titel)"}
          </label>
          <div className="flex flex-wrap items-center gap-2 text-[0.95rem] text-slate">
            {fields.artist ? <span>{fields.artist}</span> : null}
            <Badge variant={candidate.kind === "chordbank" ? "info" : "outline"}>
              {candidate.kind === "chordbank" ? "Med akkorder" : "Ren tekst"}
            </Badge>
            <span className="truncate text-muted-foreground">{item.fileName}</span>
          </div>
          {problem ? (
            <p className="text-[0.95rem] font-semibold text-danger">
              {problem}{" "}
              {candidate.existing && candidate.status !== "new" && !errors ? (
                <Link
                  href={songHref(clubId, candidate.existing.id)}
                  className="text-primary underline underline-offset-4"
                >
                  Se «{candidate.existing.title}»
                </Link>
              ) : null}
            </p>
          ) : null}
          {candidate.notes.map((note) => (
            <p key={note} className="text-[0.95rem] text-slate">
              {note}
            </p>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={item.open}
          onClick={() => onChange((current) => ({ ...current, open: !current.open }))}
        >
          {item.open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
          {item.open ? "Luk" : "Vis og ret"}
        </Button>
      </div>

      {item.open ? (
        <DraftEditor
          fields={fields}
          errors={errors}
          onField={(field, value) =>
            onChange((current) => ({ ...current, fields: { ...current.fields, [field]: value } }))
          }
          onRemove={onRemove}
        />
      ) : null}
    </li>
  );
}

/** The song form's fields for one draft, with a preview and the format guide. */
function DraftEditor({
  fields,
  errors,
  onField,
  onRemove,
}: {
  fields: DraftFields;
  errors: FieldErrors | null;
  onField: (field: keyof DraftFields, value: string) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const bind = (field: keyof DraftFields) => ({
    value: fields[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onField(field, event.currentTarget.value),
    errors: errors?.[field],
  });

  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <InputField
        name="title"
        label="Titel"
        maxLength={SONG_TITLE_MAX_LENGTH}
        autoComplete="off"
        {...bind("title")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          name="artist"
          label="Kunstner"
          optional="valgfri"
          maxLength={SONG_ARTIST_MAX_LENGTH}
          autoComplete="off"
          {...bind("artist")}
        />
        <InputField
          name="melody"
          label="Melodi"
          optional="valgfri"
          maxLength={SONG_MELODY_MAX_LENGTH}
          autoComplete="off"
          {...bind("melody")}
        />
      </div>
      {preview ? (
        <section
          aria-label="Forhåndsvisning"
          className="rounded-xl border border-border bg-cream/50 px-4 py-4"
        >
          <SongTextView body={cleanSongText(fields.body)} mode="chords" />
        </section>
      ) : (
        <FieldShell label="Tekst og akkorder" errors={errors?.body}>
          {(control) => (
            <Textarea
              {...control}
              value={fields.body}
              onChange={(event) => onField("body", event.currentTarget.value)}
              rows={14}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="field-sizing-fixed resize-y overflow-x-auto font-mono text-[0.95rem] leading-relaxed whitespace-pre"
            />
          )}
        </FieldShell>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => setPreview((p) => !p)}>
          {preview ? "Rediger tekst" : "Forhåndsvis"}
        </Button>
        <Button type="button" variant="ghost" onClick={onRemove}>
          <Trash2Icon aria-hidden />
          Fjern fra listen
        </Button>
      </div>
      <SongFormatHelp />
    </div>
  );
}
