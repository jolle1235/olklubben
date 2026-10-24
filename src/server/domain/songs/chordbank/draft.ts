import type { ChordBankSong } from "./chordbank";
import { roundTrip } from "./round-trip";
import { chooseSongTitle } from "./title";
import { storedLines } from "./to-stored-text";

/**
 * The shared core of both imports (CLI and app, D-156): a parsed ChordBank
 * printout → its title (the heading rule, with the file stem), the round
 * trip, and the stored lines joined (before cleanSongText). Each import adds
 * its own checks on top.
 */
export function chordBankDraft(song: ChordBankSong, stem: string) {
  const lyrics = song.blocks.filter((b) => b.kind === "lyric").map((b) => b.text);
  return {
    chosen: chooseSongTitle(song.heading, stem, lyrics),
    roundTrip: roundTrip(song.blocks),
    joined: storedLines(song.blocks).join("\n"),
  };
}
