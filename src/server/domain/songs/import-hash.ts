import { createHash } from "node:crypto";

/** What an import writes and later compares (Song's title, artist, melody and body). */
export type SongContent = {
  title: string;
  artist: string | null;
  melody: string | null;
  body: string;
};

/**
 * Song.importHash: sha256 hex of JSON [title, artist, melody, body] as an
 * import wrote them. A row that no longer hashes to it was edited in the app,
 * so a re-import leaves it alone (scripts/songbook/plan.ts).
 */
export function contentHash(song: SongContent): string {
  return createHash("sha256")
    .update(JSON.stringify([song.title, song.artist, song.melody, song.body]))
    .digest("hex");
}
