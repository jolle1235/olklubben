import { lineKind, type SongLineKind } from "@/server/domain/songs/song-text";

import type { Block, BlockKind } from "./chordbank";
import { storedLines } from "./to-stored-text";

/**
 * The always-on proof that storing a song as plain text loses nothing: every
 * stored line, classified by the APP's lineKind (no fonts), must have the kind
 * the PDF fonts gave it. Any disagreement is FEJL for that song.
 */

const APP_KIND: Record<BlockKind, SongLineKind> = {
  blank: "blank",
  section: "section",
  note: "note",
  chord: "chords",
  lyric: "lyric",
};

export type RoundTripDisagreement = {
  line: number;
  font: SongLineKind;
  text: SongLineKind;
  value: string;
};

export function roundTrip(blocks: readonly Block[]): {
  lines: number;
  disagreements: RoundTripDisagreement[];
} {
  const lines = storedLines(blocks);
  const disagreements: RoundTripDisagreement[] = [];
  blocks.forEach((block, i) => {
    const value = lines[i] ?? "";
    const font = APP_KIND[block.kind];
    const text = lineKind(value);
    if (font !== text) disagreements.push({ line: i + 1, font, text, value });
  });
  return { lines: lines.length, disagreements };
}
