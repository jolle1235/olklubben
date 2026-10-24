/**
 * Tiny PDFs for the songbook's PDF import tests (unit and E2E). Made-up text
 * only: real songs never enter the repo (SPEC §19.1 rule 10).
 */

export type TextRun = { text: string; x: number; y: number; size: number; font?: "F1" | "F2" };

/** A one-page Letter PDF with the runs as separate text objects (Helvetica / Helvetica-Bold). */
export function buildPdf(runs: readonly TextRun[]): Uint8Array<ArrayBuffer> {
  const escape = (text: string) => text.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = runs
    .map(
      (r) =>
        `BT /${r.font ?? "F1"} ${r.size} Tf 1 0 0 1 ${r.x} ${r.y} Tm (${escape(r.text)}) Tj ET`,
    )
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
