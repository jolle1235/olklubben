/**
 * A small parser for `pdftohtml -xml` output: the <fontspec> table and every
 * <text> run with its page, position and font. No XML dependency: poppler's
 * output is flat and regular. Inner <b>, <i> and <a> tags are stripped, and the
 * XML entities are decoded.
 *
 * Font ids are global across pages (poppler numbers them once per document),
 * so all fontspecs are read first. An id defined twice with different specs,
 * or a run that names an unknown id, is an error.
 */

export type PdfFont = { family: string; size: number };

/** One text run as poppler reports it (px at 1.5 × PDF points). */
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

const FONTSPEC_RE = /<fontspec\b([^>]*)>/g;
const PAGE_OR_TEXT_RE = /<page\b([^>]*)>|<text\b([^>]*)>([\s\S]*?)<\/text>/g;
const ATTRIBUTE_RE = /([A-Za-z_][\w-]*)="([^"]*)"/g;
const TAG_RE = /<[^>]*>/g;
const ENTITY_RE = /&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/g;
const SUBSET_PREFIX_RE = /^[A-Z]{6}\+/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function attributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE_RE)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) out[name] = decodeEntities(value);
  }
  return out;
}

/** &amp; &lt; &gt; &quot; &apos; &#N; &#xN; in one pass (never double-decodes). */
export function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (whole, entity: string) => {
    if (entity.startsWith("#x")) return safeCodePoint(Number.parseInt(entity.slice(2), 16), whole);
    if (entity.startsWith("#")) return safeCodePoint(Number.parseInt(entity.slice(1), 10), whole);
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

function safeCodePoint(code: number, fallback: string): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : fallback;
}

function intAttribute(attrs: Record<string, string>, name: string, where: string): number {
  const value = Number.parseInt(attrs[name] ?? "", 10);
  if (!Number.isFinite(value)) throw new Error(`${where} mangler attributten ${name}`);
  return value;
}

/** The fonts and runs of one document, in document order. Throws on malformed input. */
export function parsePdfXml(xml: string): { fonts: Map<string, PdfFont>; runs: PdfRun[] } {
  if (!xml.includes("<pdf2xml")) throw new Error("Ikke pdftohtml -xml output (mangler <pdf2xml>)");

  const fonts = new Map<string, PdfFont>();
  for (const match of xml.matchAll(FONTSPEC_RE)) {
    const attrs = attributes(match[1] ?? "");
    const id = attrs.id;
    if (id === undefined) throw new Error("<fontspec> uden id");
    const font = {
      family: (attrs.family ?? "").replace(SUBSET_PREFIX_RE, ""),
      size: intAttribute(attrs, "size", `<fontspec id="${id}">`),
    };
    const known = fonts.get(id);
    if (known && (known.family !== font.family || known.size !== font.size)) {
      throw new Error(`Skrifttype ${id} er defineret to gange forskelligt`);
    }
    fonts.set(id, font);
  }

  const runs: PdfRun[] = [];
  let page = 0;
  for (const match of xml.matchAll(PAGE_OR_TEXT_RE)) {
    if (match[1] !== undefined) {
      page = intAttribute(attributes(match[1]), "number", "<page>");
      continue;
    }
    const attrs = attributes(match[2] ?? "");
    const fontId = attrs.font ?? "";
    const font = fonts.get(fontId);
    if (!font) throw new Error(`<text> bruger en ukendt skrifttype (font="${fontId}")`);
    runs.push({
      page,
      top: intAttribute(attrs, "top", "<text>"),
      left: intAttribute(attrs, "left", "<text>"),
      width: intAttribute(attrs, "width", "<text>"),
      family: font.family,
      size: font.size,
      text: decodeEntities((match[3] ?? "").replace(TAG_RE, "")),
    });
  }
  return { fonts, runs };
}
