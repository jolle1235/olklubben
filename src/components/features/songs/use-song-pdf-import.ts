"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { validationError, type FieldErrors } from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { songsHref } from "@/lib/routes";
import { songFieldsSchema } from "@/lib/validation/song";
import {
  SONG_IMPORT_BATCH_SIZE,
  SONG_PDF_MAX_BYTES,
  SONG_PDF_TOO_LARGE,
} from "@/lib/validation/song-import";
import {
  importSongsAction,
  readSongPdfAction,
  type SongImportCandidate,
} from "@/server/actions/song-import";
import { songTitleKey } from "@/server/domain/songs/title";
import type { SongImportSkip } from "@/server/songs/mutations";

/**
 * The state of "Importér fra PDF" (SPEC §9.6, D-156): the files being read
 * (one Server Action call per PDF, three at a time), the drafts in review and
 * the import in batches. The page (song-pdf-import.tsx) only renders it.
 */

export type DraftFields = { title: string; artist: string; melody: string; body: string };

/** A draft in the review list: always with its candidate and editable fields. */
export type ReadyItem = {
  key: number;
  fileName: string;
  phase: "ready";
  candidate: SongImportCandidate;
  fields: DraftFields;
  selected: boolean;
  open: boolean;
};

export type ImportItem =
  | { key: number; fileName: string; phase: "reading" }
  | { key: number; fileName: string; phase: "failed"; error: string }
  | ReadyItem;

export type ImportResult = { created: number; skipped: SongImportSkip[] };

const CONCURRENCY = 3;

// Fields are replaced, never mutated, so their identity keys the result: a
// keystroke re-validates (and re-cleans the body of) only the edited song.
const validated = new WeakMap<DraftFields, FieldErrors | null>();

export function validateDraft(fields: DraftFields): FieldErrors | null {
  let errors = validated.get(fields);
  if (errors === undefined) {
    const parsed = songFieldsSchema.safeParse(fields);
    errors = parsed.success ? null : (validationError(parsed.error).error.fieldErrors ?? null);
    validated.set(fields, errors);
  }
  return errors;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** One PDF → its list item (ready or failed). */
async function readFile(clubId: string, key: number, file: File): Promise<ImportItem> {
  const base = { key, fileName: file.name };
  if (file.size > SONG_PDF_MAX_BYTES)
    return { ...base, phase: "failed", error: SONG_PDF_TOO_LARGE };
  const formData = new FormData();
  formData.set("file", file);
  const response = await readSongPdfAction(clubId, formData).catch(() => null);
  if (!response?.ok) {
    const error = response?.error.message ?? "PDF'en kunne ikke sendes. Tjek forbindelsen.";
    return { ...base, phase: "failed", error };
  }
  const candidate = response.data;
  return {
    ...base,
    phase: "ready",
    candidate,
    fields: {
      title: candidate.title,
      artist: candidate.artist,
      melody: candidate.melody,
      body: candidate.body,
    },
    selected: candidate.status === "new" && candidate.fieldErrors === null,
    open: false,
  };
}

export function useSongPdfImport(clubId: string) {
  const router = useRouter();
  const nextKey = useRef(0);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const replace = (next: ImportItem) =>
    setItems((current) => current.map((item) => (item.key === next.key ? next : item)));

  function updateReady(key: number, change: (item: ReadyItem) => ReadyItem) {
    setItems((current) =>
      current.map((item) => (item.key === key && item.phase === "ready" ? change(item) : item)),
    );
  }

  function remove(key: number) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function addFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter(isPdfFile);
    if (files.length === 0) return;
    setResult(null);
    const queue = files.map((file) => ({ key: (nextKey.current += 1), file }));
    setItems((current) => [
      ...current,
      ...queue.map(({ key, file }) => ({ key, fileName: file.name, phase: "reading" as const })),
    ]);
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        replace(await readFile(clubId, next.key, next.file));
      }
    };
    void Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const reading = items.filter((i) => i.phase === "reading").length;
  const ready = items.filter((i): i is ReadyItem => i.phase === "ready");
  const selected = ready.filter((i) => i.selected && !validateDraft(i.fields));
  const titleCounts = new Map<string, number>();
  for (const item of selected) {
    const key = songTitleKey(item.fields.title);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const isDuplicate = (item: ReadyItem) =>
    item.selected && (titleCounts.get(songTitleKey(item.fields.title)) ?? 0) > 1;
  const allSelected = ready.length > 0 && ready.every((i) => i.selected || validateDraft(i.fields));

  function toggleAll() {
    const select = !allSelected;
    setItems((current) =>
      current.map((item) => (item.phase === "ready" ? { ...item, selected: select } : item)),
    );
  }

  async function importSelected() {
    setImporting(true);
    setImportError(null);
    const total: ImportResult = { created: 0, skipped: [] };
    const done = new Set<number>();
    try {
      for (let i = 0; i < selected.length; i += SONG_IMPORT_BATCH_SIZE) {
        const batch = selected.slice(i, i + SONG_IMPORT_BATCH_SIZE);
        const response = await importSongsAction(
          clubId,
          batch.map(({ fields, candidate }) => ({
            ...fields,
            sourceKey: candidate.sourceKey,
            importHash: candidate.importHash,
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
    if (total.skipped.length === 0 && done.size === items.length) {
      router.push(withToast(songsHref(clubId), "songs-imported"));
      return;
    }
    setItems((current) => current.filter((item) => !done.has(item.key)));
    setResult(total);
    router.refresh();
  }

  return {
    items,
    reading,
    readyCount: ready.length,
    selectedCount: selected.length,
    hasDuplicates: [...titleCounts.values()].some((n) => n > 1),
    allSelected,
    isDuplicate,
    importing,
    importError,
    result,
    addFiles,
    updateReady,
    remove,
    toggleAll,
    importSelected,
  };
}
