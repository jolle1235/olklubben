import { join, parse as parsePath } from "node:path";

import { songFieldsSchema } from "../../src/lib/validation/song";
import {
  cleanSongText,
  lineKind,
  lyricsOnlyLines,
  parseSong,
} from "../../src/server/domain/songs/song-text";
import { songTitleKey } from "../../src/server/domain/songs/title";

import { detectAnomalies, type Anomaly } from "./anomalies";
import { extractChordBankSong, type ChordBankStats } from "./chordbank";
import type { SongbookOverrides } from "./overrides";
import { parsePdfXml } from "./pdf-xml";
import { pdfToXml } from "./pdftohtml";
import { roundTrip, type RoundTripDisagreement } from "./round-trip";
import { chooseSongTitle, type TitleSource } from "./title";
import { storedLines } from "./to-stored-text";

/**
 * One PDF → the song the importer would store, with every self-check:
 * known fonts only, the round trip (0 disagreements), cleanSongText(body) is
 * the body, the overrides apply, and songFieldsSchema accepts the result.
 * Any failure is a FEJL (`errors`), and a song with errors is never written.
 */

export type ParsedSong = {
  file: string;
  sourceKey: string;
  heading: string;
  fileTitle: string;
  title: string;
  titleKey: string;
  titleSource: TitleSource;
  titleNotes: string[];
  artist: string | null;
  melody: null;
  body: string;
  headerChords: string[];
  pages: number;
  stats: ChordBankStats | null;
  counts: { lyricLines: number; chordLines: number; sections: number; stanzas: number };
  roundTrip: { lines: number; disagreements: RoundTripDisagreement[] };
  anomalies: Anomaly[];
  errors: string[];
};

export const SOURCE_KEY_PREFIX = "chordbank:";
const SOURCE_KEY_MAX_LENGTH = 300;

/** "chordbank:<file name NFC>": how a re-import finds its row. */
export function sourceKeyOf(file: string): string {
  return SOURCE_KEY_PREFIX + file.normalize("NFC");
}

function emptySong(file: string, errors: string[]): ParsedSong {
  return {
    file,
    sourceKey: sourceKeyOf(file),
    heading: "",
    fileTitle: parsePath(file).name,
    title: parsePath(file).name,
    titleKey: songTitleKey(parsePath(file).name),
    titleSource: "overskrift",
    titleNotes: [],
    artist: null,
    melody: null,
    body: "",
    headerChords: [],
    pages: 0,
    stats: null,
    counts: { lyricLines: 0, chordLines: 0, sections: 0, stanzas: 0 },
    roundTrip: { lines: 0, disagreements: [] },
    anomalies: [],
    errors,
  };
}

/** `diskName` is the name in the folder; the song's `file` is its NFC form. */
export async function parseSongFile(
  dir: string,
  diskName: string,
  overrides: SongbookOverrides,
): Promise<ParsedSong> {
  const file = diskName.normalize("NFC");
  let xml: string;
  try {
    xml = await pdfToXml(join(dir, diskName));
  } catch (error) {
    return emptySong(file, [`pdftohtml fejlede: ${(error as Error).message.split("\n")[0]}`]);
  }
  let runs;
  try {
    runs = parsePdfXml(xml).runs;
  } catch (error) {
    return emptySong(file, [`XML kunne ikke læses: ${(error as Error).message}`]);
  }
  return buildSong(file, extractChordBankSong(runs), overrides);
}

function buildSong(
  file: string,
  song: ReturnType<typeof extractChordBankSong>,
  overrides: SongbookOverrides,
): ParsedSong {
  const errors: string[] = [];
  const key = file;
  if (song.unknownFonts.length > 0)
    errors.push(`ukendt skrifttype: ${song.unknownFonts.join(", ")}`);
  if (song.heading === "") errors.push("ingen titel (overskrift) i PDF'en");
  if (sourceKeyOf(file).length > SOURCE_KEY_MAX_LENGTH) errors.push("filnavnet er for langt");

  const lyricTexts = song.blocks.filter((b) => b.kind === "lyric").map((b) => b.text);
  const chosen = chooseSongTitle(song.heading, parsePath(file).name, lyricTexts);

  const rt = roundTrip(song.blocks);
  if (rt.disagreements.length > 0) {
    errors.push(`round trip: ${rt.disagreements.length} uenigheder mellem skrifttype og tekst`);
  }
  const joined = storedLines(song.blocks).join("\n");
  let body = cleanSongText(joined);
  if (body !== joined) errors.push("cleanSongText ændrer den gemte tekst (round trip gælder ikke)");

  for (const { find, replace } of overrides.replacements.filter((r) => r.file === key)) {
    if (!body.includes(find)) errors.push(`erstatning ikke fundet i teksten: «${find}»`);
    else body = cleanSongText(body.replaceAll(find, replace));
  }

  const titleOverride = overrides.titles[key];
  const artistOverride = Object.hasOwn(overrides.artists, key) ? overrides.artists[key] : undefined;
  const fields = songFieldsSchema.safeParse({
    title: titleOverride ?? chosen.title,
    artist: artistOverride === undefined ? song.artist : artistOverride,
    melody: null,
    body,
  });
  if (!fields.success) {
    errors.push(...fields.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const data = fields.success
    ? fields.data
    : { title: titleOverride ?? chosen.title, artist: song.artist, melody: null, body };
  if (cleanSongText(data.body) !== data.body)
    errors.push("cleanSongText er ikke idempotent på teksten");

  const lines = data.body.split("\n");
  return {
    file,
    sourceKey: sourceKeyOf(file),
    heading: song.heading,
    fileTitle: chosen.fileTitle,
    title: data.title,
    titleKey: songTitleKey(data.title),
    titleSource: titleOverride === undefined ? chosen.source : "override",
    titleNotes: chosen.notes,
    artist: data.artist,
    melody: null,
    body: data.body,
    headerChords: song.headerChords,
    pages: song.pages,
    stats: song.stats,
    counts: {
      lyricLines: lyricsOnlyLines(data.body).length,
      chordLines: lines.filter((l) => lineKind(l) === "chords").length,
      sections: lines.filter((l) => lineKind(l) === "section").length,
      stanzas: parseSong(data.body).filter((s) => !s.instrumental).length,
    },
    roundTrip: rt,
    anomalies: detectAnomalies({
      title: data.title,
      heading: song.heading,
      fileTitle: chosen.fileTitle,
      titleDiffersFromFile: chosen.differsFromFile,
      titleOverridden: titleOverride !== undefined,
      body: data.body,
      headerChords: song.headerChords,
      stats: song.stats,
    }),
    errors,
  };
}
