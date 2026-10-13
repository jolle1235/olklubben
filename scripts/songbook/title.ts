/**
 * The title of an imported song (the prototype's rule; overrides.json is
 * applied after it):
 *
 *   1. The words come from the ALL-CAPS heading, i.e. what the printout
 *      shows (a heading wrapped over 2 rows is already joined).
 *   2. The file stem is cleaned: "_" → space, whitespace collapsed.
 *   3. If the stem has deliberate casing (any upper-case letter), a heading
 *      word that also occurs in it takes the stem's spelling ("Skagen", "the").
 *   4. Otherwise, a word the lyrics always write the same way mid-sentence,
 *      and not in plain lower case, keeps that casing. For the first word
 *      only when that form has an inner capital ("McSkipper").
 *   5. Everything else is lower case; then the first letter is capitalised.
 */

export type TitleSource = "overskrift" | "filnavn" | "tekst" | "override";

export type ChosenTitle = {
  title: string;
  source: Exclude<TitleSource, "override">;
  /** The cleaned file stem ("Turen til Skagen_" → "Turen til Skagen"). */
  fileTitle: string;
  /** The heading's words differ from the file name (more than casing and punctuation). */
  differsFromFile: boolean;
  notes: string[];
};

const HAS_UPPER_RE = /\p{Lu}/u;
const SENTENCE_BREAKS = new Set([".", "!", "?", ":", '"', "”", "“"]);
const TOKEN_RE = /[\p{L}\p{N}_'’-]+|[.!?:"”“]/gu;
const WORD_START_RE = /^[\p{L}\p{N}_]/u;

/** "havn_i_sigte" → "havn i sigte", "Kaptajn Knud_" → "Kaptajn Knud". */
export function fileTitle(stem: string): string {
  return stem.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

/** Letters and digits only, lower case: compares a title with the file name. */
export function foldTitle(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "");
}

/** word (lower case) → the one casing the lyrics use mid-sentence, if not plain lower case. */
function lyricCaseHints(lyricLines: readonly string[]): Map<string, string> {
  const seen = new Map<string, Set<string>>();
  for (const line of lyricLines) {
    const tokens = line.match(TOKEN_RE) ?? [];
    let prev: string | null = null;
    tokens.forEach((token, i) => {
      if (!WORD_START_RE.test(token)) {
        prev = token;
        return;
      }
      if (i > 0 && (prev === null || !SENTENCE_BREAKS.has(prev))) {
        const word = token.replace(/^['’-]+|['’-]+$/g, "");
        if (word !== "") {
          const low = word.toLowerCase();
          const forms = seen.get(low) ?? new Set<string>();
          forms.add(word);
          seen.set(low, forms);
        }
      }
      prev = token;
    });
  }
  const hints = new Map<string, string>();
  for (const [low, forms] of seen) {
    const [only] = [...forms];
    if (forms.size === 1 && only !== undefined && only !== low) hints.set(low, only);
  }
  return hints;
}

export function chooseSongTitle(
  heading: string,
  stem: string,
  lyricLines: readonly string[],
): ChosenTitle {
  const notes: string[] = [];
  const fname = fileTitle(stem);
  const deliberate = HAS_UPPER_RE.test(fname);
  const fileWords = new Map(fname.split(" ").map((w) => [w.toLowerCase(), w] as const));
  const hints = lyricCaseHints(lyricLines);
  let source: ChosenTitle["source"] = "overskrift";

  const words = heading
    .split(/\s+/)
    .filter((w) => w !== "")
    .map((word, i) => {
      const low = word.toLowerCase();
      const fromFile = fileWords.get(low);
      if (deliberate && fromFile !== undefined) {
        // The first letter is capitalised anyway, so only later words count.
        if (fromFile !== low && i > 0) {
          notes.push(`stavemåde fra filnavnet: ${fromFile}`);
          source = "filnavn";
        }
        return fromFile;
      }
      const hint = hints.get(low);
      if (hint !== undefined && (i > 0 || HAS_UPPER_RE.test(hint.slice(1)))) {
        notes.push(`stavemåde fra teksten: ${hint}`);
        source = "tekst";
        return hint;
      }
      return low;
    });

  const joined = words.join(" ");
  const title = joined.charAt(0).toUpperCase() + joined.slice(1);
  const differsFromFile = foldTitle(title) !== foldTitle(fname);
  if (differsFromFile) notes.push(`overskriften «${heading}» ≠ filnavnet «${fname}»`);
  return { title, source, fileTitle: fname, differsFromFile, notes };
}
