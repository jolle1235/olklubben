/**
 * One text run of a PDF in poppler's `pdftohtml -xml` coordinates: px at
 * 1.5 × PDF points, `top` the top of the text box. Produced by the CLI from
 * poppler's XML (scripts/songbook/pdf-xml.ts) and by the app from pdf.js
 * (src/server/songs/pdf-runs.ts), so the ChordBank parser reads both alike.
 */
export type PdfRun = {
  page: number;
  top: number;
  left: number;
  width: number;
  /** Family without the subset prefix ("AAAAAB+OpenSans-ExtraBold" → "OpenSans-ExtraBold"). */
  family: string;
  size: number;
  text: string;
};
