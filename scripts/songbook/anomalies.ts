import { lineTokens } from "../../src/server/domain/songs/chords";
import {
  deriveChords,
  lineKind,
  lyricsOnlyLines,
  parseSong,
} from "../../src/server/domain/songs/song-text";

import type { ChordBankStats } from "./chordbank";
import { oddChars } from "./clean";

/**
 * Things in a parsed song a human may want to look at. `decision: true` puts
 * it in the report's "Kræver en beslutning" block; the others are plain
 * flags in the song's row. None of them stops an import (FEJL does).
 */

export type AnomalyCode =
  | "TITLE_DIFFERS"
  | "PLACEHOLDER_X"
  | "ODD_CHARS"
  | "LONG_LINES"
  | "ELLIPSIS"
  | "CHORDS_IN_LYRIC_FONT"
  | "LABEL_IN_LYRIC_FONT"
  | "POSITIONED_CHORDS"
  | "SOFT_WRAP_JOINED"
  | "NO_STANZAS"
  | "CAPO"
  | "HEADER_CHORDS_DIFFER"
  | "UNKNOWN_CHORD_TOKEN";

export type Anomaly = { code: AnomalyCode; decision: boolean; text: string };

/** A lone capital X used as a name ("Skål, X!"): probably anonymised. */
const PLACEHOLDER_X_RE = /(?:^|[\s,])X(?:[\s,?!]|$)/;
const ELLIPSIS_RE = /(?:\.\.\.|…)$/;
/** Enharmonic oddities that are almost always a typo ("H#m7"). */
const ODD_ROOT_RE = /^\(?(?:[EBH]#|[CFH]b)/;
const LONG_LINE = 60;

export function detectAnomalies(input: {
  title: string;
  heading: string;
  fileTitle: string;
  titleDiffersFromFile: boolean;
  titleOverridden: boolean;
  body: string;
  headerChords: readonly string[];
  stats: ChordBankStats;
}): Anomaly[] {
  const { body, stats } = input;
  const out: Anomaly[] = [];
  const add = (code: AnomalyCode, decision: boolean, text: string) =>
    out.push({ code, decision, text });
  const lyrics = lyricsOnlyLines(body);
  const lines = body.split("\n");

  if (input.titleDiffersFromFile || input.titleOverridden) {
    add(
      "TITLE_DIFFERS",
      true,
      `overskriften «${input.heading}» ≠ filnavnet «${input.fileTitle}» → titlen bliver «${input.title}»` +
        (input.titleOverridden ? " (overrides.json)" : ""),
    );
  }
  if (PLACEHOLDER_X_RE.test(lyrics.join("\n"))) {
    add(
      "PLACEHOLDER_X",
      true,
      `pladsholder «X» i teksten (${lyrics.filter((l) => PLACEHOLDER_X_RE.test(l)).length} linjer)`,
    );
  }
  const odd = oddChars(lines.join("\n"));
  if (odd.length > 0) add("ODD_CHARS", true, `usædvanlige tegn: ${odd.join(" ")}`);

  const long = lyrics.filter((l) => l.length > LONG_LINE).length;
  if (long > 0) add("LONG_LINES", false, `${long} tekstlinjer over ${LONG_LINE} tegn`);
  const ellipsis = lyrics.filter((l) => ELLIPSIS_RE.test(l)).length;
  if (ellipsis > 0) add("ELLIPSIS", false, `${ellipsis} linjer ender på «…»`);

  if (stats.chordsInLyricFont > 0) {
    add(
      "CHORDS_IN_LYRIC_FONT",
      true,
      `${stats.chordsInLyricFont} akkordlinjer skrevet med tekstens skrift`,
    );
  }
  if (stats.relabelledSections > 0) {
    add(
      "LABEL_IN_LYRIC_FONT",
      false,
      `${stats.relabelledSections} afsnitsnavne skrevet med tekstens skrift`,
    );
  }
  if (stats.positionedChordRows > 0) {
    add(
      "POSITIONED_CHORDS",
      false,
      `${stats.positionedChordRows} akkordlinjer placeret over stavelser`,
    );
  }
  if (stats.softWrapsJoined > 0) {
    add("SOFT_WRAP_JOINED", false, `${stats.softWrapsJoined} ombrudte linjer sat sammen`);
  }

  const stanzas = parseSong(body).filter((s) => !s.instrumental).length;
  if (stanzas <= 1)
    add("NO_STANZAS", true, "ét langt vers i tekstvisningen (kilden har ingen versskift)");

  const notes = lines.filter((l) => lineKind(l) === "note").map((l) => l.trim());
  if (notes.length > 0) add("CAPO", false, `spillenote: ${notes.map((n) => `«${n}»`).join(", ")}`);

  const derived = deriveChords(body);
  if (derived.join(" ") !== input.headerChords.join(" ")) {
    add(
      "HEADER_CHORDS_DIFFER",
      true,
      `akkordrækken i PDF'en (${input.headerChords.join(" ")}) ≠ akkorderne i teksten (${derived.join(" ")})`,
    );
  }

  const oddTokens = new Set<string>();
  for (const line of lines) {
    if (lineKind(line) !== "chords") continue;
    for (const token of lineTokens(line)) if (ODD_ROOT_RE.test(token)) oddTokens.add(token);
  }
  if (oddTokens.size > 0) {
    add("UNKNOWN_CHORD_TOKEN", true, `usædvanlige akkorder: ${[...oddTokens].join(" ")}`);
  }
  return out;
}
