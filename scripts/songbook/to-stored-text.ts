import { cleanSongText } from "../../src/server/domain/songs/song-text";

import type { Block } from "./chordbank";

/**
 * Blocks → the stored lines of Song.body: a label is written "[<Danish
 * label>]", every other block is its text, a blank block an empty line.
 */
export function storedLines(blocks: readonly Block[]): string[] {
  return blocks.map((block) =>
    block.kind === "section" ? `[${block.label ?? block.text}]` : block.text,
  );
}

/** The stored body: the lines joined, then the app's cleanSongText (LF, NFC, rtrim, blank runs). */
export function toStoredText(blocks: readonly Block[]): string {
  return cleanSongText(storedLines(blocks).join("\n"));
}
