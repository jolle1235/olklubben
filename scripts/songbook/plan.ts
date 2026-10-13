import { createHash } from "node:crypto";

/**
 * What an import would do with each parsed song, given the club's current
 * songs. Pure: the CLI prints the plan on a dry run, and --apply recomputes
 * it inside the transaction from fresh rows (apply.ts).
 *
 * Idempotency: a song is matched by (clubId, sourceKey = "chordbank:<file>").
 * importHash is the sha256 of [title, artist, melody, body] as the importer
 * last wrote them, so an admin's edit in the app is detected exactly.
 *
 *   NY                 no match, and the club has no imported songs yet → created
 *   NY?                no match, but the club has imported before: deleted in the
 *                      app, or a new file. Created only with --include-new
 *   UÆNDRET            the new parse hashes to importHash
 *   OPDATERES          untouched since import, and the new parse differs → updated
 *   REDIGERET I APPEN  changed in the app since import → skipped
 *                      (--overwrite-edited, only with --only, forces an update)
 *   TITEL OPTAGET      another song of the club has the title key → skipped
 *   FEJL               a parse error or self-check failure, or two files with the
 *                      same title key → never written
 *   FORÆLDRELØS        a club song whose file is gone → report only, never deleted
 */

export type ImportStatus =
  | "NY"
  | "NY?"
  | "UÆNDRET"
  | "OPDATERES"
  | "REDIGERET I APPEN"
  | "TITEL OPTAGET"
  | "FEJL"
  | "FORÆLDRELØS";

export type SongContent = {
  title: string;
  artist: string | null;
  melody: string | null;
  body: string;
};

/** A club song as the plan needs it. */
export type ExistingSong = SongContent & {
  id: string;
  titleKey: string;
  sourceKey: string | null;
  importHash: string | null;
  updatedAt: Date;
};

/** A parsed song as the plan needs it (song.ts ParsedSong fits). */
export type IncomingSong = SongContent & {
  file: string;
  sourceKey: string;
  titleKey: string;
  errors: readonly string[];
};

export type PlanItem = {
  status: ImportStatus;
  /** Null for FORÆLDRELØS. */
  song: (IncomingSong & { hash: string }) | null;
  existing: { id: string; title: string; sourceKey: string | null; updatedAt: Date } | null;
  /** True when --apply writes it (create, or update guarded by existing.updatedAt). */
  write: boolean;
  note: string | null;
};

export type PlanFlags = {
  includeNew: boolean;
  overwriteEdited: boolean;
  /** --only: only some files were parsed, so missing files are not orphans. */
  partial: boolean;
};

/** sha256 hex of JSON [title, artist, melody, body]. */
export function contentHash(song: SongContent): string {
  return createHash("sha256")
    .update(JSON.stringify([song.title, song.artist, song.melody, song.body]))
    .digest("hex");
}

export function planSongImport(
  existing: readonly ExistingSong[],
  incoming: readonly IncomingSong[],
  flags: PlanFlags,
): PlanItem[] {
  const bySource = new Map(
    existing.flatMap((e) => (e.sourceKey ? [[e.sourceKey, e] as const] : [])),
  );
  const byTitleKey = new Map(existing.map((e) => [e.titleKey, e] as const));
  const hasImported = existing.some((e) => e.sourceKey !== null);

  const titleFiles = new Map<string, string[]>();
  for (const song of incoming) {
    if (song.errors.length > 0) continue;
    titleFiles.set(song.titleKey, [...(titleFiles.get(song.titleKey) ?? []), song.file]);
  }

  const ref = (e: ExistingSong) => ({
    id: e.id,
    title: e.title,
    sourceKey: e.sourceKey,
    updatedAt: e.updatedAt,
  });

  const items: PlanItem[] = incoming.map((song): PlanItem => {
    const withHash = { ...song, hash: contentHash(song) };
    const item = (
      status: ImportStatus,
      write: boolean,
      note: string | null,
      match: ExistingSong | null = null,
    ): PlanItem => ({ status, song: withHash, existing: match ? ref(match) : null, write, note });

    if (song.errors.length > 0) return item("FEJL", false, song.errors.join("; "));
    const sameTitle = (titleFiles.get(song.titleKey) ?? []).filter((f) => f !== song.file);
    if (sameTitle.length > 0) {
      return item("FEJL", false, `samme titel som ${sameTitle.map((f) => `«${f}»`).join(", ")}`);
    }

    const match = bySource.get(song.sourceKey);
    const holder = byTitleKey.get(song.titleKey);
    if (match) {
      const edited = contentHash(match) !== match.importHash;
      if (edited && !flags.overwriteEdited) {
        return item(
          "REDIGERET I APPEN",
          false,
          "ændret i appen siden importen; springes over",
          match,
        );
      }
      if (!edited && withHash.hash === match.importHash) return item("UÆNDRET", false, null, match);
      if (holder && holder.id !== match.id) {
        return item("TITEL OPTAGET", false, `titlen bruges allerede af «${holder.title}»`, match);
      }
      return item(
        "OPDATERES",
        true,
        edited ? "overskriver ændringer fra appen (--overwrite-edited)" : null,
        match,
      );
    }
    if (holder) {
      const who = holder.sourceKey
        ? `en anden importeret sang (${holder.sourceKey})`
        : "en sang, der er lavet i appen";
      return item(
        "TITEL OPTAGET",
        false,
        `titlen bruges allerede af ${who}: «${holder.title}»`,
        holder,
      );
    }
    if (!hasImported) return item("NY", true, null);
    return item(
      "NY?",
      flags.includeNew,
      flags.includeNew
        ? "oprettes (--include-new)"
        : "slettet i appen eller ny fil; kræver --include-new",
    );
  });

  if (!flags.partial) {
    const parsed = new Set(incoming.map((s) => s.sourceKey));
    for (const e of existing) {
      if (e.sourceKey && !parsed.has(e.sourceKey)) {
        items.push({
          status: "FORÆLDRELØS",
          song: null,
          existing: ref(e),
          write: false,
          note: `filen til «${e.title}» findes ikke længere; intet slettes`,
        });
      }
    }
  }
  return items;
}
