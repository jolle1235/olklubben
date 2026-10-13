import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Runs poppler's `pdftohtml -xml` (poppler-utils, the same package as
 * pdftotext). Always execFile with an ARGUMENT ARRAY, never a shell string:
 * the file names come from the PDF folder and may contain anything.
 *
 * `-xml -i -q -nodrm -stdout` gives every text run with its font and
 * top/left/width, without images. That is the ground truth the ChordBank
 * parser (chordbank.ts) needs.
 */

const run = promisify(execFile);

const PDFTOHTML = "pdftohtml";
const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 16 * 1024 * 1024;

export const PDFTOHTML_MISSING =
  "pdftohtml mangler. Installér poppler-utils (fx sudo apt install poppler-utils).";

/** The XML of one PDF (UTF-8). */
export async function pdfToXml(path: string): Promise<string> {
  const { stdout } = await run(PDFTOHTML, ["-xml", "-i", "-q", "-nodrm", "-stdout", path], {
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    encoding: "utf8",
  });
  return stdout;
}

/** "pdftohtml version 24.02.0", or null when pdftohtml is not installed. */
export async function pdftohtmlVersion(): Promise<string | null> {
  try {
    // `pdftohtml -v` prints to stderr.
    const { stdout, stderr } = await run(PDFTOHTML, ["-v"], {
      timeout: TIMEOUT_MS,
      encoding: "utf8",
    });
    const line = `${stderr}\n${stdout}`.split("\n").find((l) => /version/i.test(l));
    return line?.trim() ?? "pdftohtml (ukendt version)";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
