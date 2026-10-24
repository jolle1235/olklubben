import "server-only";

import { getDocumentProxy, getResolvedPDFJS } from "unpdf";

import type { PdfRun } from "@/server/domain/songs/chordbank/pdf-run";

/**
 * A PDF's text runs as poppler's `pdftohtml -xml` reports them (PdfRun), read
 * with pdf.js so it runs on Vercel without poppler (SPEC §9.6, D-156).
 *
 * pdf.js's getTextContent() drops whitespace-only runs, but ChordBank's empty
 * spacer row under a chord-only row is exactly such a run. So this walks the
 * operator list instead: every showText is one run, positioned by the text
 * matrix times the CTM, and its glyph advances give the width. Runs on the
 * same baseline in the same font with a gap under one font size are merged,
 * as poppler does ("G" + "D" → "G D"). Checked against poppler on the club's
 * 59 ChordBank PDFs: the same stored text, except two positioned chord rows
 * that pdf.js places by the real glyph x (poppler estimates it).
 *
 * Only text is read: no font faces are loaded and nothing is rendered.
 */

/** pdftohtml's zoom: px = 1.5 × PDF points. */
const SCALE = 1.5;
const SUBSET_PREFIX_RE = /^[A-Z]{6}\+/;
/** Poppler names the family without its style ("CBSans-Bold" → "CBSans"). */
const STYLE_SUFFIX_RE = /-(?:Regular|Roman|Book|Bold|Italic|Oblique|BoldItalic|BoldOblique)$/;
/** A run joins the one before it when the gap is under this many font sizes. */
const MERGE_GAP = 1;

export class PdfReadError extends Error {
  constructor(
    readonly reason: "invalid" | "encrypted" | "too-many-pages",
    message: string,
  ) {
    super(message);
    this.name = "PdfReadError";
  }
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

function translate(x: number, y: number, m: Matrix): Matrix {
  return multiply([1, 0, 0, 1, x, y], m);
}

/** The parts of a pdf.js font and glyph this reader uses. */
type LoadedFont = { name?: string; ascent?: number; fontMatrix?: number[] };
type Glyph = { unicode?: string; width?: number; isSpace?: boolean } | number | null;

type OpenRun = PdfRun & { end: number; baseline: number };

function familyOf(font: LoadedFont | null): string {
  return String(font?.name ?? "")
    .replace(SUBSET_PREFIX_RE, "")
    .replace(STYLE_SUFFIX_RE, "");
}

async function openDocument(data: Uint8Array) {
  try {
    return await getDocumentProxy(data, {
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
      // Errors only: a PDF with the 14 standard fonts warns about font data it does not need here.
      verbosity: 0,
    });
  } catch (error) {
    if ((error as { name?: string }).name === "PasswordException") {
      throw new PdfReadError("encrypted", "PDF'en er beskyttet med en adgangskode.");
    }
    throw new PdfReadError("invalid", "Filen kunne ikke læses som PDF.");
  }
}

/** Every text run of the PDF in reading order per page. Throws PdfReadError. */
export async function readPdfRuns(
  data: Uint8Array,
  { maxPages }: { maxPages: number },
): Promise<PdfRun[]> {
  const doc = await openDocument(data);
  try {
    if (doc.numPages > maxPages) {
      throw new PdfReadError("too-many-pages", `PDF'en har over ${maxPages} sider.`);
    }
    const { OPS } = await getResolvedPDFJS();
    const runs: OpenRun[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const [, bottom = 0, , top = 0] = page.view;
      const pageHeight = top - bottom;
      const { fnArray, argsArray } = await page.getOperatorList();

      let ctm = IDENTITY;
      const saved: Matrix[] = [];
      let textMatrix = IDENTITY;
      let lineMatrix = IDENTITY;
      let font: LoadedFont | null = null;
      let fontSize = 1;
      let charSpacing = 0;
      let wordSpacing = 0;
      let hScale = 1;
      let leading = 0;

      for (let i = 0; i < fnArray.length; i += 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf.js operator arguments are untyped
        const args = argsArray[i] as any[];
        switch (fnArray[i]) {
          case OPS.save:
            saved.push(ctm);
            break;
          case OPS.restore:
            ctm = saved.pop() ?? IDENTITY;
            break;
          case OPS.transform:
            ctm = multiply(args as Matrix, ctm);
            break;
          case OPS.beginText:
            textMatrix = lineMatrix = IDENTITY;
            break;
          case OPS.setTextMatrix: {
            const m = (args[0] ?? args) as number[];
            textMatrix = lineMatrix = [m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!];
            break;
          }
          case OPS.moveText:
            textMatrix = lineMatrix = translate(args[0], args[1], lineMatrix);
            break;
          case OPS.setLeadingMoveText:
            leading = -args[1];
            textMatrix = lineMatrix = translate(args[0], args[1], lineMatrix);
            break;
          case OPS.nextLine:
            textMatrix = lineMatrix = translate(0, -leading, lineMatrix);
            break;
          case OPS.setLeading:
            leading = args[0];
            break;
          case OPS.setFont:
            try {
              font = page.commonObjs.get(args[0]) as LoadedFont;
            } catch {
              font = null;
            }
            fontSize = args[1];
            break;
          case OPS.setCharSpacing:
            charSpacing = args[0];
            break;
          case OPS.setWordSpacing:
            wordSpacing = args[0];
            break;
          case OPS.setHScale:
            hScale = args[0] / 100;
            break;
          case OPS.showText:
          case OPS.showSpacedText: {
            const glyphScale = (font?.fontMatrix?.[0] ?? 0.001) * fontSize;
            let advance = 0;
            let text = "";
            for (const glyph of args[0] as Glyph[]) {
              if (typeof glyph === "number") {
                advance -= (glyph * fontSize) / 1000;
              } else if (glyph) {
                text += glyph.unicode ?? "";
                advance +=
                  ((glyph.width ?? 0) * glyphScale +
                    charSpacing +
                    (glyph.isSpace ? wordSpacing : 0)) *
                  hScale;
              }
            }
            const m = multiply(textMatrix, ctm);
            const size = Math.hypot(m[2], m[3]) * fontSize;
            const xScale = Math.hypot(m[0], m[1]);
            textMatrix = translate(advance, 0, textMatrix);
            if (text === "" || size === 0) break;

            const run: OpenRun = {
              page: pageNumber,
              top: Math.round((pageHeight - m[5] - (font?.ascent ?? 0.8) * size) * SCALE),
              left: Math.round(m[4] * SCALE),
              width: Math.round(advance * xScale * SCALE),
              family: familyOf(font),
              size: Math.round(size * SCALE),
              text,
              end: (m[4] + advance * xScale) * SCALE,
              baseline: m[5],
            };
            const previous = runs[runs.length - 1];
            const gap = run.left - (previous?.end ?? 0);
            if (
              previous &&
              previous.page === run.page &&
              previous.family === run.family &&
              previous.size === run.size &&
              Math.abs(previous.baseline - run.baseline) < 0.5 &&
              gap > -1 &&
              gap < MERGE_GAP * run.size
            ) {
              if (gap >= 2 && !previous.text.endsWith(" ") && !run.text.startsWith(" ")) {
                previous.text += " ";
              }
              previous.text += run.text;
              previous.end = run.end;
              previous.width = Math.round(previous.end - previous.left);
            } else {
              runs.push(run);
            }
            break;
          }
        }
      }
      page.cleanup();
    }
    return runs.map(({ page, top, left, width, family, size, text }) => ({
      page,
      top,
      left,
      width,
      family,
      size,
      text,
    }));
  } finally {
    await doc.loadingTask.destroy();
  }
}
