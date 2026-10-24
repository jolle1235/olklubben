/**
 * Song.sourceKey of an imported song: "<prefix><file name NFC>", how a
 * re-import finds its row. The CLI (scripts/import-songbook.ts) and the
 * in-app PDF import (D-156) share it, so they recognise each other's songs.
 * At most 300 characters (songs_source_key_length_check).
 */

export const SOURCE_KEY_MAX_LENGTH = 300;

const SOURCE_KEY_PREFIXES = { chordbank: "chordbank:", text: "pdf:" } as const;

export function sourceKeyOf(file: string, kind: keyof typeof SOURCE_KEY_PREFIXES = "chordbank") {
  return SOURCE_KEY_PREFIXES[kind] + file.normalize("NFC");
}
