"use client";

import { PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SongTextView } from "./song-text-view";

/** The text as the reader's chords view shows it, with the way back to the field on top. */
export function SongPreview({
  body,
  onEdit,
  editRef,
}: {
  body: string;
  onEdit: () => void;
  editRef: React.Ref<HTMLButtonElement>;
}) {
  return (
    <section
      aria-label="Forhåndsvisning"
      className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-cream/50 px-4 py-4 sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.95rem] font-semibold text-slate">Forhåndsvisning med akkorder</p>
        <Button ref={editRef} type="button" variant="outline" onClick={onEdit}>
          <PencilIcon aria-hidden />
          Rediger tekst
        </Button>
      </div>
      {body === "" ? (
        <p className="text-muted-foreground">Der er ingen tekst at vise endnu.</p>
      ) : (
        <SongTextView body={body} mode="chords" />
      )}
    </section>
  );
}
