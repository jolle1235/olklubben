import { describe, expect, it } from "vitest";

import type { PdfRun } from "./chordbank/pdf-run";
import { pdfTextSong } from "./pdf-text";

// Made-up lines only (SPEC §19.1 rule 10: never real lyrics).
const run = (top: number, left: number, text: string, size = 16, page = 1): PdfRun => ({
  page,
  top,
  left,
  width: text.length * 8,
  family: "Helvetica",
  size,
  text,
});

describe("pdfTextSong", () => {
  it("reads lines top to bottom and splits stanzas on a large gap", () => {
    const song = pdfTextSong([
      run(100, 100, "Første linje om humle"),
      run(121, 100, "anden linje om malt"),
      run(170, 100, "nyt vers om gær"),
    ]);
    expect(song.heading).toBeNull();
    expect(song.lines).toEqual([
      "Første linje om humle",
      "anden linje om malt",
      "",
      "nyt vers om gær",
    ]);
  });

  it("takes a larger first line as the heading", () => {
    const song = pdfTextSong([
      run(60, 100, "SKUMMETS VISE", 28),
      run(100, 100, "En linje"),
      run(121, 100, "to linjer"),
    ]);
    expect(song.heading).toBe("SKUMMETS VISE");
    expect(song.lines).toEqual(["En linje", "to linjer"]);
  });

  it("joins runs on one line with a space where there is a gap", () => {
    const song = pdfTextSong([
      run(100, 100, "Skål"),
      run(100, 150, "for"),
      run(101, 182, "bryggeren"),
    ]);
    expect(song.lines).toEqual(["Skål for bryggeren"]);
  });

  it("keeps a chord line's columns over the lyric below", () => {
    // 8 px per character: G over column 0, D over column 10.
    const song = pdfTextSong([
      run(100, 100, "G"),
      run(100, 180, "D"),
      run(121, 100, "Humle og malt i karret"),
    ]);
    expect(song.lines).toEqual(["G         D", "Humle og malt i karret"]);
  });

  it("drops page numbers and reads a page break as a continuation", () => {
    const song = pdfTextSong([
      run(100, 100, "sidste linje på side et"),
      run(700, 300, "1"),
      run(100, 100, "første linje på side to", 16, 2),
    ]);
    expect(song.lines).toEqual(["sidste linje på side et", "første linje på side to"]);
  });

  it("is empty without text", () => {
    expect(pdfTextSong([run(100, 100, "   ")])).toEqual({ heading: null, lines: [] });
  });
});
