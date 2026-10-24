"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, Trash2Icon } from "lucide-react";

import { FieldShell } from "@/components/features/forms/form-fields";
import { useAfterServerAnswer } from "@/components/features/forms/use-after-server-answer";
import { Button } from "@/components/ui/button";

import { BeerPhoto } from "./beer-photo";

/**
 * "Billede (valgfrit)" in the beer form (SPEC §9.5, D-158): take a photo or
 * pick one. A large photo is scaled down in the browser (longest side 1200
 * px, JPEG) before it is sent, so a phone photo fits the upload limit; the
 * server re-encodes it anyway (src/server/beers/image.ts). Without
 * JavaScript the file input works as is.
 *
 * React resets the form after every server answer (F-053), which empties a
 * file input. The chosen photo is kept in state and put back into the input
 * after each answer (useAfterServerAnswer), so "Tilføj alligevel" still sends it.
 *
 * Editing: the current photo is shown with [Fjern billede], which sends
 * removeImage=1; choosing a new photo replaces it.
 */

/** What the server keeps (src/server/beers/image.ts), so nothing larger is sent. */
const MAX_SIDE = 1200;
/** Below this, the file is sent as it is. */
const RESIZE_FROM_BYTES = 1.5 * 1024 * 1024;

async function shrink(file: File): Promise<File> {
  if (file.size <= RESIZE_FROM_BYTES || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // A format the browser cannot draw: let the server decide.
    return file;
  }
}

function putFile(input: HTMLInputElement | null, file: File | null) {
  if (!input) return;
  const transfer = new DataTransfer();
  if (file) transfer.items.add(file);
  input.files = transfer.files;
}

export function BeerImageField({
  currentImageUrl,
  error,
  actionState,
}: {
  /** The saved photo when editing, else null. */
  currentImageUrl: string | null;
  error?: string;
  /** The form's action state: the photo is put back after every server answer. */
  actionState: unknown;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The chosen photo and its blob: URL for the preview, revoked when replaced.
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(
    () => () => {
      if (chosen) URL.revokeObjectURL(chosen.url);
    },
    [chosen],
  );

  useAfterServerAnswer(actionState, () => putFile(inputRef.current, chosen?.file ?? null));

  async function choose(picked: File | undefined) {
    if (!picked) return;
    setProcessing(true);
    const ready = await shrink(picked);
    putFile(inputRef.current, ready);
    setChosen({ file: ready, url: URL.createObjectURL(ready) });
    setRemoved(false);
    setProcessing(false);
  }

  function clear() {
    putFile(inputRef.current, null);
    setChosen(null);
    if (currentImageUrl) setRemoved(true);
  }

  const shown = chosen?.url ?? (removed ? null : currentImageUrl);

  return (
    <FieldShell label="Billede" optional="valgfrit" errors={error ? [error] : undefined}>
      {(control) => (
        <>
          {removed ? <input type="hidden" name="removeImage" value="1" /> : null}
          {shown ? (
            <BeerPhoto src={shown} alt="Billede af øllen" className="max-h-64 w-fit max-w-full" />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <label htmlFor={control.id} className="cursor-pointer">
                <CameraIcon aria-hidden />
                {processing
                  ? "Gør billedet klar …"
                  : shown
                    ? "Skift billede"
                    : "Tag eller vælg billede"}
              </label>
            </Button>
            {shown ? (
              <Button type="button" variant="ghost" onClick={clear}>
                <Trash2Icon aria-hidden />
                Fjern billede
              </Button>
            ) : null}
          </div>
          <input
            {...control}
            ref={inputRef}
            type="file"
            name="image"
            accept="image/*"
            className="sr-only"
            onChange={(event) => void choose(event.currentTarget.files?.[0])}
          />
        </>
      )}
    </FieldShell>
  );
}
