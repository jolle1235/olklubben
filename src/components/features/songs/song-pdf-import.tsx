"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileUpIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";

import { InputField, FieldShell } from "@/components/features/forms/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { songHref, songsHref } from "@/lib/routes";
import { songFieldsSchema } from "@/lib/validation/song";
import { SONG_IMPORT_BATCH_SIZE, SONG_PDF_MAX_BYTES } from "@/lib/validation/song-import";
import {
  importSongsAction,
  readSongPdfAction,
  type SongImportCandidate,
} from "@/server/actions/song-import";
import type { SongImportSkip } from "@/server/songs/mutations";
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

/**
 * "Importér fra PDF" (SPEC §9.6, D-156), admins only. The admin picks one or
 * more PDFs (one song per file). Each is read on the server, one request per
 * file, three at a time, and lands in a review list: title, artist, "Med
 * akkorder" (ChordBank) or "Ren tekst", and whether the club already has it.
 * Every song can be opened and corrected with the song form's fields and
 * schema. [Importér] sends the ticked songs in batches; songs that cannot be
 * imported (same file or title) are reported, never overwritten.
 *
 * Needs JavaScript (a multi-step upload); "Tilføj sang" still works without.
 */

type Fields = { title: string; artist: string; melody: string; body: string };

type Item = {
  key: number;
  fileName: string;
  phase: "reading" | "ready" | "failed";
  error: string | null;
  candidate: SongImportCandidate | null;
  fields: Fields;
  selected: boolean;
  open: boolean;
};

type Result = { created: number; skipped: SongImportSkip[] };

const CONCURRENCY = 3;

const SKIP_REASONS: Record<SongImportSkip["reason"], string> = {
  imported: "filen er importeret før",
  "title-taken": "titlen findes allerede i sangbogen",
  duplicate: "to af de valgte sange hedder det samme",
};

function validate(fields: Fields): FieldErrors | null {
  const parsed = songFieldsSchema.safeParse(fields);
  if (parsed.success) return null;
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    (errors[String(issue.path[0] ?? "_form")] ??= []).push(issue.message);
  }
  return errors;
}

function songsLabel(count: number): string {
  return count === 1 ? "1 sang" : `${count} sange`;
}

export function SongPdfImport({ clubId }: { clubId: string }) {
  const router = useRouter();
  const nextKey = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const update = (key: number, change: (item: Item) => Item) =>
    setItems((current) => current.map((item) => (item.key === key ? change(item) : item)));

  async function read(key: number, file: File) {
    if (file.size > SONG_PDF_MAX_BYTES) {
      update(key, (item) => ({
        ...item,
        phase: "failed",
        error: "PDF'en er for stor (højst 4 MB).",
      }));
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    let response;
    try {
      response = await readSongPdfAction(clubId, formData);
    } catch {
      response = null;
    }
    if (!response?.ok) {
      const error = response?.error.message ?? "PDF'en kunne ikke sendes. Tjek forbindelsen.";
      update(key, (item) => ({ ...item, phase: "failed", error }));
      return;
    }
    const candidate = response.data;
    update(key, (item) => ({
      ...item,
      phase: "ready",
      candidate,
      fields: {
        title: candidate.title,
        artist: candidate.artist,
        melody: candidate.melody,
        body: candidate.body,
      },
      selected: candidate.status === "new" && candidate.fieldErrors === null,
    }));
  }

  function addFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    if (files.length === 0) return;
    setResult(null);
    const added = files.map((file) => ({ key: (nextKey.current += 1), file }));
    setItems((current) => [
      ...current,
      ...added.map(({ key, file }) => ({
        key,
        fileName: file.name,
        phase: "reading" as const,
        error: null,
        candidate: null,
        fields: { title: "", artist: "", melody: "", body: "" },
        selected: false,
        open: false,
      })),
    ]);
    const queue = [...added];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await read(next.key, next.file);
    };
    void Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const reading = items.filter((i) => i.phase === "reading").length;
  const ready = items.filter((i) => i.phase === "ready");
  const errorsOf = new Map(ready.map((i) => [i.key, validate(i.fields)]));
  const selected = ready.filter((i) => i.selected && !errorsOf.get(i.key));
  const titleCounts = new Map<string, number>();
  for (const item of selected) {
    const key = songTitleKey(item.fields.title);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const hasDuplicates = [...titleCounts.values()].some((n) => n > 1);
  const allSelected = ready.length > 0 && ready.every((i) => i.selected || errorsOf.get(i.key));

  async function importSelected() {
    setImporting(true);
    setImportError(null);
    const total: Result = { created: 0, skipped: [] };
    const done = new Set<number>();
    try {
      for (let i = 0; i < selected.length; i += SONG_IMPORT_BATCH_SIZE) {
        const batch = selected.slice(i, i + SONG_IMPORT_BATCH_SIZE);
        const response = await importSongsAction(
          clubId,
          batch.map((item) => ({
            ...item.fields,
            sourceKey: item.candidate!.sourceKey,
            importHash: item.candidate!.importHash,
          })),
        );
        if (!response.ok) {
          setImportError(response.error.message);
          break;
        }
        total.created += response.data.created;
        total.skipped.push(...response.data.skipped);
        for (const item of batch) done.add(item.key);
      }
    } catch {
      setImportError("Importen blev afbrudt. Tjek forbindelsen, og prøv igen.");
    }
    setImporting(false);
    if (done.size === 0) return;
    if (total.skipped.length === 0 && done.size === selected.length && items.length === done.size) {
      router.push(withToast(songsHref(clubId), "songs-imported"));
      return;
    }
    setItems((current) => current.filter((item) => !done.has(item.key)));
    setResult(total);
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-paper/60 px-6 py-10 text-center transition-colors focus-within:border-primary hover:border-primary",
          dragging && "border-primary bg-cream",
        )}
      >
        <FileUpIcon aria-hidden className="size-8 text-primary" />
        <span className="text-lg font-semibold text-ink">Vælg PDF&apos;er</span>
        <span className="max-w-md text-[0.95rem] text-muted-foreground">
          Én sang pr. fil. Du kan vælge mange på én gang eller trække dem herind. Udskrifter fra
          ChordBank kommer med akkorder; andre PDF&apos;er bliver til tekst, du kan rette til.
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </label>

      <p aria-live="polite" className="text-[0.95rem] text-slate empty:hidden">
        {reading > 0 ? `Læser ${items.length - reading} af ${items.length} PDF'er …` : ""}
      </p>

      {result ? <ImportSummary clubId={clubId} result={result} /> : null}

      {items.length > 0 ? (
        <section aria-label="Sange fra PDF'erne" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              {songsLabel(selected.length)} valgt af {items.length}
            </h2>
            <Button
              type="button"
              variant="outline"
              disabled={ready.length === 0}
              onClick={() =>
                setItems((current) =>
                  current.map((item) => ({
                    ...item,
                    selected: item.phase === "ready" && !allSelected,
                  })),
                )
              }
            >
              {allSelected ? "Fravælg alle" : "Vælg alle"}
            </Button>
          </div>

          <ul className="grid gap-3">
            {items.map((item) => (
              <ImportRow
                key={item.key}
                clubId={clubId}
                item={item}
                errors={errorsOf.get(item.key) ?? null}
                duplicate={
                  item.selected && (titleCounts.get(songTitleKey(item.fields.title)) ?? 0) > 1
                }
                onChange={(change) => update(item.key, change)}
                onRemove={() =>
                  setItems((current) => current.filter((other) => other.key !== item.key))
                }
              />
            ))}
          </ul>

          <div className="sticky bottom-20 z-10 grid gap-3 rounded-2xl border border-border bg-paper p-4 shadow-sm md:bottom-4">
            {importError ? <FormError>{importError}</FormError> : null}
            {hasDuplicates ? (
              <p className="text-[0.95rem] font-semibold text-danger">
                To af de valgte sange hedder det samme. Ret den ene titel, eller fravælg den.
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={importing || reading > 0 || selected.length === 0 || hasDuplicates}
              aria-busy={importing || undefined}
              onClick={importSelected}
            >
              {importing ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
              {importing
                ? "Importerer …"
                : selected.length === 0
                  ? "Vælg de sange, der skal med"
                  : `Importér ${songsLabel(selected.length)}`}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ImportSummary({ clubId, result }: { clubId: string; result: Result }) {
  return (
    <section
      role="status"
      className="grid gap-2 rounded-2xl border border-border bg-harbor-tint/50 p-4"
    >
      <p className="font-semibold text-ink">
        {result.created === 1
          ? "1 sang er importeret 🎵"
          : `${result.created} sange er importeret 🎵`}
      </p>
      {result.skipped.length > 0 ? (
        <>
          <p className="text-[0.95rem] text-slate">Disse blev sprunget over:</p>
          <ul className="list-disc pl-6 text-[0.95rem] text-slate">
            {result.skipped.map((skip, i) => (
              <li key={i}>
                «{skip.title}»: {SKIP_REASONS[skip.reason]}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Link
        href={songsHref(clubId)}
        className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
      >
        Gå til sangbogen
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </section>
  );
}

function ImportRow({
  clubId,
  item,
  errors,
  duplicate,
  onChange,
  onRemove,
}: {
  clubId: string;
  item: Item;
  errors: FieldErrors | null;
  duplicate: boolean;
  onChange: (change: (item: Item) => Item) => void;
  onRemove: () => void;
}) {
  const { candidate, fields } = item;
  const [preview, setPreview] = useState(false);
  const setField =
    (field: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.currentTarget.value;
      onChange((current) => ({ ...current, fields: { ...current.fields, [field]: value } }));
    };

  if (item.phase !== "ready" || !candidate) {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-border bg-paper px-4 py-3">
        {item.phase === "reading" ? (
          <Loader2Icon aria-hidden className="size-5 shrink-0 animate-spin text-slate" />
        ) : null}
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-semibold text-ink">{item.fileName}</span>
          <span className={cn("text-[0.95rem]", item.error ? "text-danger" : "text-slate")}>
            {item.error ?? "Læser …"}
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

  const titleUnchanged = songTitleKey(fields.title) === songTitleKey(candidate.title);
  const problem = errors
    ? "Ret felterne, før sangen kan importeres."
    : candidate.status === "imported"
      ? "Filen er importeret før."
      : candidate.status === "title-taken" && titleUnchanged
        ? "Titlen findes allerede i sangbogen. Giv den en anden titel for at importere den."
        : duplicate
          ? "En anden af de valgte sange hedder det samme."
          : null;
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
        <div className="grid gap-4 border-t border-border pt-4">
          <InputField
            name="title"
            label="Titel"
            value={fields.title}
            onChange={setField("title")}
            maxLength={SONG_TITLE_MAX_LENGTH}
            autoComplete="off"
            errors={errors?.title}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              name="artist"
              label="Kunstner"
              optional="valgfri"
              value={fields.artist}
              onChange={setField("artist")}
              maxLength={SONG_ARTIST_MAX_LENGTH}
              autoComplete="off"
              errors={errors?.artist}
            />
            <InputField
              name="melody"
              label="Melodi"
              optional="valgfri"
              value={fields.melody}
              onChange={setField("melody")}
              maxLength={SONG_MELODY_MAX_LENGTH}
              autoComplete="off"
              errors={errors?.melody}
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
                  onChange={setField("body")}
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
      ) : null}
    </li>
  );
}
