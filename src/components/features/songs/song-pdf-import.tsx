"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, FileUpIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { songsHref } from "@/lib/routes";
import type { SongImportSkip } from "@/server/songs/mutations";
import { cn } from "@/lib/utils";

import { ImportRow } from "./song-import-row";
import { useSongPdfImport, type ImportResult } from "./use-song-pdf-import";

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

const SKIP_REASONS: Record<SongImportSkip["reason"], string> = {
  imported: "filen er importeret før",
  "title-taken": "titlen findes allerede i sangbogen",
  duplicate: "to af de valgte sange hedder det samme",
};

function songsLabel(count: number): string {
  return count === 1 ? "1 sang" : `${count} sange`;
}

export function SongPdfImport({ clubId }: { clubId: string }) {
  const state = useSongPdfImport(clubId);
  const { items, reading, selectedCount } = state;

  return (
    <div className="grid gap-6">
      <PdfDropzone onFiles={state.addFiles} />

      <p aria-live="polite" className="text-[0.95rem] text-slate empty:hidden">
        {reading > 0 ? `Læser ${items.length - reading} af ${items.length} PDF'er …` : ""}
      </p>

      {state.result ? <ImportSummary clubId={clubId} result={state.result} /> : null}

      {items.length > 0 ? (
        <section aria-label="Sange fra PDF'erne" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              {songsLabel(selectedCount)} valgt af {items.length}
            </h2>
            <Button
              type="button"
              variant="outline"
              disabled={state.readyCount === 0}
              onClick={state.toggleAll}
            >
              {state.allSelected ? "Fravælg alle" : "Vælg alle"}
            </Button>
          </div>

          <ul className="grid gap-3">
            {items.map((item) => (
              <ImportRow
                key={item.key}
                clubId={clubId}
                item={item}
                duplicate={item.phase === "ready" && state.isDuplicate(item)}
                onChange={(change) => state.updateReady(item.key, change)}
                onRemove={() => state.remove(item.key)}
              />
            ))}
          </ul>

          <ImportFooter state={state} />
        </section>
      ) : null}
    </div>
  );
}

/** The sticky bar with [Importér N sange] and why it may be disabled. */
function ImportFooter({ state }: { state: ReturnType<typeof useSongPdfImport> }) {
  const { importing, reading, selectedCount, hasDuplicates } = state;
  const label = importing
    ? "Importerer …"
    : selectedCount === 0
      ? "Vælg de sange, der skal med"
      : `Importér ${songsLabel(selectedCount)}`;
  return (
    <div className="sticky bottom-20 z-10 grid gap-3 rounded-2xl border border-border bg-paper p-4 shadow-sm md:bottom-4">
      {state.importError ? <FormError>{state.importError}</FormError> : null}
      {hasDuplicates ? (
        <p className="text-[0.95rem] font-semibold text-danger">
          To af de valgte sange hedder det samme. Ret den ene titel, eller fravælg den.
        </p>
      ) : null}
      <Button
        type="button"
        size="lg"
        disabled={importing || reading > 0 || selectedCount === 0 || hasDuplicates}
        aria-busy={importing || undefined}
        onClick={state.importSelected}
      >
        {importing ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}

/** The file picker, also a drop target. */
function PdfDropzone({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles(event.dataTransfer.files);
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
          onFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function ImportSummary({ clubId, result }: { clubId: string; result: ImportResult }) {
  return (
    <section
      role="status"
      className="grid gap-2 rounded-2xl border border-border bg-harbor-tint/50 p-4"
    >
      <p className="font-semibold text-ink">{`${songsLabel(result.created)} er importeret 🎵`}</p>
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
