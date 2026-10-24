import { describe, expect, it } from "vitest";

import { buildPdf } from "../../../tests/support/pdf";

import { readSongPdf } from "./pdf-import";
import { PdfReadError, readPdfRuns } from "./pdf-runs";

/**
 * Reads tiny PDFs (tests/support/pdf.ts, made-up text only) through
 * pdf.js: the runs in poppler's coordinates, the whitespace-only run pdf.js's
 * own text extraction would drop, and the plain-text draft. The ChordBank
 * path was checked against poppler on the club's real PDFs (D-156).
 */

describe("readPdfRuns", () => {
  it("gives every run in pdftohtml's px (1.5 × points), the space-only run included", async () => {
    const runs = await readPdfRuns(
      buildPdf([
        { text: "Humlevise", x: 72, y: 700, size: 12 },
        { text: " ", x: 72, y: 680, size: 12 },
      ]),
      { maxPages: 5 },
    );
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      page: 1,
      left: 108,
      size: 18,
      family: "Helvetica",
      text: "Humlevise",
    });
    expect(runs[0]!.width).toBeGreaterThan(70);
    // top = (792 − 700 − ascent × 12) × 1.5, a little above the baseline.
    expect(runs[0]!.top).toBeGreaterThan(115);
    expect(runs[0]!.top).toBeLessThan(138);
    expect(runs[1]!.text).toBe(" ");
  });

  it("merges runs on one baseline in the same font, as poppler does", async () => {
    const runs = await readPdfRuns(
      buildPdf([
        { text: "G", x: 72, y: 700, size: 10, font: "F2" },
        { text: "D", x: 82, y: 700, size: 10, font: "F2" },
        { text: "C", x: 300, y: 700, size: 10, font: "F2" },
      ]),
      { maxPages: 5 },
    );
    expect(runs.map((r) => [r.text, r.family])).toEqual([
      ["G D", "Helvetica"],
      ["C", "Helvetica"],
    ]);
  });

  it("refuses what is not a PDF and too many pages", async () => {
    await expect(
      readPdfRuns(new Uint8Array(Buffer.from("ikke en pdf")), { maxPages: 5 }),
    ).rejects.toBeInstanceOf(PdfReadError);
    await expect(readPdfRuns(buildPdf([]), { maxPages: 0 })).rejects.toMatchObject({
      reason: "too-many-pages",
    });
  });
});

describe("readSongPdf", () => {
  it("reads a PDF that is not from ChordBank as plain text with its heading as title", async () => {
    const draft = await readSongPdf(
      "skummets-vise.pdf",
      buildPdf([
        { text: "SKUMMETS VISE", x: 72, y: 720, size: 20 },
        { text: "G", x: 72, y: 690, size: 11 },
        { text: "D", x: 130, y: 690, size: 11 },
        { text: "Humle og malt og vand i karret", x: 72, y: 676, size: 11 },
        { text: "skummet stiger op til randen", x: 72, y: 662, size: 11 },
        { text: "Nyt vers om bryggerens hat", x: 72, y: 620, size: 11 },
      ]),
    );
    expect(draft.kind).toBe("text");
    expect(draft.sourceKey).toBe("pdf:skummets-vise.pdf");
    expect(draft.title).toBe("Skummets vise");
    expect(draft.artist).toBeNull();
    const lines = draft.body.split("\n");
    expect(lines[0]).toMatch(/^G +D$/);
    expect(lines.slice(1)).toEqual([
      "Humle og malt og vand i karret",
      "skummet stiger op til randen",
      "",
      "Nyt vers om bryggerens hat",
    ]);
    expect(draft.notes).toEqual(["Læst som ren tekst. Tjek vers og akkorder, før du importerer."]);
  });

  it("uses the file name as title without a heading, and says when there is no text", async () => {
    const draft = await readSongPdf("Min_sang.PDF", buildPdf([]));
    expect(draft.title).toBe("Min sang");
    expect(draft.body).toBe("");
    expect(draft.notes[0]).toMatch(/ingen tekst/);
  });
});
