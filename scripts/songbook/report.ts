import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AnomalyCode } from "./anomalies";
import type { ImportStatus, PlanItem } from "./plan";
import type { ParsedSong } from "./song";

/**
 * The importer's Danish output. By default it prints NO lyric text: titles,
 * artists, counts, flags and statuses only (--show prints one whole song).
 * The JSON report (with bodies) goes under data/, which is git-ignored.
 */

const FLAG_NAMES: Record<AnomalyCode, string> = {
  TITLE_DIFFERS: "titel≠filnavn",
  PLACEHOLDER_X: "X-pladsholder",
  ODD_CHARS: "usædvanlige tegn",
  LONG_LINES: "lange linjer",
  ELLIPSIS: "«…»",
  CHORDS_IN_LYRIC_FONT: "akkorder i tekstskrift",
  LABEL_IN_LYRIC_FONT: "afsnit i tekstskrift",
  POSITIONED_CHORDS: "placerede akkorder",
  SOFT_WRAP_JOINED: "ombrud samlet",
  NO_STANZAS: "ét vers",
  CAPO: "capo",
  HEADER_CHORDS_DIFFER: "akkordrække≠tekst",
  UNKNOWN_CHORD_TOKEN: "usædvanlig akkord",
};

const STATUS_WIDTH = 18;

function songRow(status: string, song: ParsedSong, note: string | null): string {
  const flags = song.anomalies.map((a) => FLAG_NAMES[a.code]);
  const c = song.counts;
  const lines = [
    `${status.padEnd(STATUS_WIDTH)}${song.file} → «${song.title}» (${song.titleSource})` +
      (song.artist ? ` · ${song.artist}` : ""),
    `${" ".repeat(STATUS_WIDTH)}${c.lyricLines} tekstlinjer · ${c.chordLines} akkordlinjer · ` +
      `${c.sections} afsnit · ${c.stanzas} vers i tekstvisning · ${song.pages} sider` +
      (flags.length > 0 ? ` · ${flags.join(", ")}` : ""),
  ];
  if (note) lines.push(`${" ".repeat(STATUS_WIDTH)}→ ${note}`);
  for (const d of song.roundTrip.disagreements) {
    lines.push(
      `${" ".repeat(STATUS_WIDTH)}linje ${d.line}: skrift siger ${d.font}, teksten ${d.text}`,
    );
  }
  return lines.join("\n");
}

/** Parse only: one row per song. */
export function printParsedSongs(songs: readonly ParsedSong[]): void {
  for (const song of songs) {
    const fejl = song.errors.length > 0;
    console.log(songRow(fejl ? "FEJL" : "LÆST", song, fejl ? song.errors.join("; ") : null));
  }
}

/** Dry run / apply: one row per plan item, in file order; orphans last. */
export function printPlan(plan: readonly PlanItem[], songs: readonly ParsedSong[]): void {
  const byFile = new Map(songs.map((s) => [s.file, s]));
  for (const item of plan) {
    const song = item.song ? byFile.get(item.song.file) : undefined;
    if (song) console.log(songRow(item.status, song, item.note));
    else
      console.log(
        `${item.status.padEnd(STATUS_WIDTH)}«${item.existing?.title ?? "?"}» → ${item.note ?? ""}`,
      );
  }
}

const SUMMARY: [ImportStatus, string][] = [
  ["NY", "nye"],
  ["OPDATERES", "opdateres"],
  ["UÆNDRET", "uændrede"],
  ["REDIGERET I APPEN", "redigeret i appen"],
  ["NY?", "NY?"],
  ["TITEL OPTAGET", "titel optaget"],
  ["FORÆLDRELØS", "forældreløse"],
  ["FEJL", "fejl"],
];

export function planSummary(plan: readonly PlanItem[]): string {
  return SUMMARY.map(
    ([status, label]) => `${plan.filter((i) => i.status === status).length} ${label}`,
  ).join(" · ");
}

/** "Kræver en beslutning", the round-trip total and the error count. */
export function printFindings(songs: readonly ParsedSong[]): void {
  const decisions = songs.flatMap((s) =>
    s.anomalies.filter((a) => a.decision).map((a) => `  ${s.file}: ${a.text}`),
  );
  console.log("\nKræver en beslutning:");
  console.log(decisions.length > 0 ? decisions.join("\n") : "  (intet)");

  const lines = songs.reduce((sum, s) => sum + s.roundTrip.lines, 0);
  const disagreements = songs.reduce((sum, s) => sum + s.roundTrip.disagreements.length, 0);
  console.log(`\nRound trip: ${disagreements} uenigheder på ${lines} linjer`);
  const errors = songs.filter((s) => s.errors.length > 0).length;
  console.log(`${songs.length} sange læst · ${errors} med FEJL`);
}

/** --show: the complete stored body of one song (this prints lyrics). */
export function printShow(song: ParsedSong): void {
  console.log(
    `\n──── ${song.file} → «${song.title}»${song.artist ? ` · ${song.artist}` : ""} ────`,
  );
  console.log(song.body);
  console.log("──── slut ────");
}

export async function writeJsonReport(
  path: string,
  report: Record<string, unknown>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 1)}\n`, "utf8");
}
