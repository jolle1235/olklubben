import { readFile } from "node:fs/promises";

import { z } from "zod";

/**
 * data/sangbog/overrides.json (git-ignored, optional): the human decisions
 * the parser cannot make, so the dev import and Jesper's production import
 * give the same text.
 *
 *   { "titles":       { "<fil.pdf>": "Titel" },
 *     "artists":      { "<fil.pdf>": "Kunstner" | null },
 *     "replacements": [ { "file": "<fil.pdf>", "find": "eksakt tekst", "replace": "…" } ] }
 *
 * Every file name must be one of the PDFs (typo guard, exit 2). A `find` that
 * does not occur in the parsed body is FEJL for that song. Titles and
 * replaced bodies must still pass songFieldsSchema (checked per song).
 */

const fileName = z.string().min(1).max(300);

const overridesSchema = z
  .object({
    titles: z.record(fileName, z.string().min(1).max(2000)).default({}),
    artists: z.record(fileName, z.string().max(2000).nullable()).default({}),
    replacements: z
      .array(
        z
          .object({
            file: fileName,
            find: z.string().min(1).max(20_000),
            replace: z.string().max(20_000),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export type SongbookOverrides = z.output<typeof overridesSchema>;

export const NO_OVERRIDES: SongbookOverrides = { titles: {}, artists: {}, replacements: [] };

/** Thrown for a bad overrides file (the CLI exits with 2). */
export class OverridesError extends Error {}

/**
 * Reads and validates the file. Missing → NO_OVERRIDES when `optional`.
 * `knownFiles` are the PDF names in the folder (NFC).
 */
export async function loadOverrides(
  path: string,
  knownFiles: ReadonlySet<string>,
  { optional }: { optional: boolean },
): Promise<SongbookOverrides> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && optional) return NO_OVERRIDES;
    throw new OverridesError(`Kan ikke læse ${path}: ${(error as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new OverridesError(`${path} er ikke gyldig JSON: ${(error as Error).message}`);
  }
  const parsed = overridesSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(rod)"}: ${i.message}`);
    throw new OverridesError(`${path} er ugyldig:\n  ${issues.join("\n  ")}`);
  }

  const normalise = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      Object.entries(record).map(([file, value]) => [file.normalize("NFC"), value]),
    );
  const overrides: SongbookOverrides = {
    titles: normalise(parsed.data.titles),
    artists: normalise(parsed.data.artists),
    replacements: parsed.data.replacements.map((r) => ({ ...r, file: r.file.normalize("NFC") })),
  };

  const named = [
    ...Object.keys(overrides.titles),
    ...Object.keys(overrides.artists),
    ...overrides.replacements.map((r) => r.file),
  ];
  const unknown = [...new Set(named.filter((file) => !knownFiles.has(file)))];
  if (unknown.length > 0) {
    throw new OverridesError(
      `${path} nævner filer, der ikke findes i PDF-mappen: ${unknown.map((f) => `«${f}»`).join(", ")}`,
    );
  }
  return overrides;
}
