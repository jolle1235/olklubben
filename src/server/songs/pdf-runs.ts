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

/** A file that is not a readable PDF, in Danish for the import list. */
export class PdfReadError extends Error {
  constructor(message: string) {
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
      throw new PdfReadError("PDF'en er beskyttet med en adgangskode.");
    }
    throw new PdfReadError("Filen kunne ikke læses som PDF.");
  }
}

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof openDocument>>["getPage"]>>;
type Ops = Awaited<ReturnType<typeof getResolvedPDFJS>>["OPS"];
type Args = unknown[];

/** The graphics and text state the runs need, as the operators change it. */
class TextState {
  ctm = IDENTITY;
  private saved: Matrix[] = [];
  textMatrix = IDENTITY;
  private lineMatrix = IDENTITY;
  font: LoadedFont | null = null;
  family = "";
  fontSize = 1;
  charSpacing = 0;
  wordSpacing = 0;
  hScale = 1;
  private leading = 0;

  constructor(private readonly page: Page) {}

  save() {
    this.saved.push(this.ctm);
  }
  restore() {
    this.ctm = this.saved.pop() ?? IDENTITY;
  }
  transform(m: Matrix) {
    this.ctm = multiply(m, this.ctm);
  }
  setLine(m: Matrix) {
    this.textMatrix = this.lineMatrix = m;
  }
  moveLine(x: number, y: number) {
    this.setLine(translate(x, y, this.lineMatrix));
  }
  setLeading(leading: number) {
    this.leading = leading;
  }
  nextLine() {
    this.moveLine(0, -this.leading);
  }
  setFont(name: string, size: number) {
    try {
      this.font = this.page.commonObjs.get(name) as LoadedFont;
    } catch {
      this.font = null;
    }
    this.family = familyOf(this.font);
    this.fontSize = size;
  }
}

/** What each text-related operator does to the state; showText is handled apart. */
function operatorHandlers(OPS: Ops): Map<number, (state: TextState, args: Args) => void> {
  const num = (args: Args, i: number) => args[i] as number;
  return new Map([
    [OPS.save, (state) => state.save()],
    [OPS.restore, (state) => state.restore()],
    [OPS.transform, (state, args) => state.transform(args as Matrix)],
    [OPS.beginText, (state) => state.setLine(IDENTITY)],
    [
      OPS.setTextMatrix,
      (state, args) => {
        const m = (args[0] ?? args) as number[];
        state.setLine([m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!]);
      },
    ],
    [OPS.moveText, (state, args) => state.moveLine(num(args, 0), num(args, 1))],
    [
      OPS.setLeadingMoveText,
      (state, args) => {
        state.setLeading(-num(args, 1));
        state.moveLine(num(args, 0), num(args, 1));
      },
    ],
    [OPS.nextLine, (state) => state.nextLine()],
    [OPS.setLeading, (state, args) => state.setLeading(num(args, 0))],
    [OPS.setFont, (state, args) => state.setFont(args[0] as string, num(args, 1))],
    [OPS.setCharSpacing, (state, args) => (state.charSpacing = num(args, 0))],
    [OPS.setWordSpacing, (state, args) => (state.wordSpacing = num(args, 0))],
    [OPS.setHScale, (state, args) => (state.hScale = num(args, 0) / 100)],
  ]);
}

/** A showText's string and its advance in text space. */
function measure(glyphs: readonly Glyph[], state: TextState): { text: string; advance: number } {
  const glyphScale = (state.font?.fontMatrix?.[0] ?? 0.001) * state.fontSize;
  let advance = 0;
  let text = "";
  for (const glyph of glyphs) {
    if (typeof glyph === "number") {
      advance -= (glyph * state.fontSize) / 1000;
    } else if (glyph) {
      text += glyph.unicode ?? "";
      const spacing = state.charSpacing + (glyph.isSpace ? state.wordSpacing : 0);
      advance += ((glyph.width ?? 0) * glyphScale + spacing) * state.hScale;
    }
  }
  return { text, advance };
}

/** Adds the run, or merges it into the one before as poppler does ("G" + "D" → "G D"). */
function appendRun(runs: OpenRun[], run: OpenRun): void {
  const previous = runs[runs.length - 1];
  const gap = run.left - (previous?.end ?? 0);
  const sameLine =
    previous !== undefined &&
    previous.family === run.family &&
    previous.size === run.size &&
    Math.abs(previous.baseline - run.baseline) < 0.5;
  if (!sameLine || gap <= -1 || gap >= MERGE_GAP * run.size) {
    runs.push(run);
    return;
  }
  if (gap >= 2 && !previous.text.endsWith(" ") && !run.text.startsWith(" ")) previous.text += " ";
  previous.text += run.text;
  previous.end = run.end;
  previous.width = Math.round(previous.end - previous.left);
}

async function pageRuns(page: Page, pageNumber: number, OPS: Ops): Promise<PdfRun[]> {
  const [, bottom = 0, , top = 0] = page.view;
  const pageHeight = top - bottom;
  const { fnArray, argsArray } = await page.getOperatorList();
  const handlers = operatorHandlers(OPS);
  const state = new TextState(page);
  const runs: OpenRun[] = [];

  fnArray.forEach((fn, i) => {
    const args = (argsArray[i] ?? []) as Args;
    if (fn !== OPS.showText && fn !== OPS.showSpacedText) {
      handlers.get(fn)?.(state, args);
      return;
    }
    const { text, advance } = measure(args[0] as Glyph[], state);
    const m = multiply(state.textMatrix, state.ctm);
    const size = Math.hypot(m[2], m[3]) * state.fontSize;
    const xScale = Math.hypot(m[0], m[1]);
    state.textMatrix = translate(advance, 0, state.textMatrix);
    if (text === "" || size === 0) return;
    appendRun(runs, {
      page: pageNumber,
      top: Math.round((pageHeight - m[5] - (state.font?.ascent ?? 0.8) * size) * SCALE),
      left: Math.round(m[4] * SCALE),
      width: Math.round(advance * xScale * SCALE),
      family: state.family,
      size: Math.round(size * SCALE),
      text,
      end: (m[4] + advance * xScale) * SCALE,
      baseline: m[5],
    });
  });
  page.cleanup();
  return runs.map(({ page: p, top: t, left, width, family, size, text }) => ({
    page: p,
    top: t,
    left,
    width,
    family,
    size,
    text,
  }));
}

/** Every text run of the PDF in reading order per page. Throws PdfReadError. */
export async function readPdfRuns(
  data: Uint8Array,
  { maxPages }: { maxPages: number },
): Promise<PdfRun[]> {
  const doc = await openDocument(data);
  try {
    if (doc.numPages > maxPages) {
      throw new PdfReadError(`PDF'en har over ${maxPages} sider.`);
    }
    const { OPS } = await getResolvedPDFJS();
    const runs: PdfRun[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      runs.push(...(await pageRuns(await doc.getPage(pageNumber), pageNumber, OPS)));
    }
    return runs;
  } finally {
    await doc.loadingTask.destroy();
  }
}
