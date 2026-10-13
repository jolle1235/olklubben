import { stripNul } from "@/lib/text";

/**
 * Songbook search (SPEC §9.6): find a song by its title, artist, melody or a
 * line one remembers. Runs in the browser over the list page's entries (the
 * same function renders `?q=` on the server), so it is instant and keeps
 * working when the bar's wifi drops.
 *
 *   * searchKey: Danish lower case, ä → æ, ö → ø, other accents dropped
 *     (é → e, ñ → n) but æ/ø/å kept, apostrophes and hyphens removed
 *     ("gi'r" ≡ "gir", "skibs-dreng" ≡ "skibsdreng"), any other run of
 *     non-letters → one space. So punctuation never stops a remembered line.
 *   * looseKey: searchKey with æ → ae, ø → o, å → a, oe → o, aa → a. Only a
 *     fallback when the strict search finds nothing ("fano" → "Fanø"):
 *     folding always would make "so" hit "sø" and "søde".
 *
 * Ranks (lower first; ties keep the given order, which is the book's):
 *   0 the title starts with the query        3 a word of artist/melody starts with it
 *   1 a title word starts with it            4 the lyrics contain it from a word start
 *   2 the title contains it mid-word (≥ 2)   5 every query word starts a word somewhere
 * A 1-character query only uses ranks 0–1. The lyrics never match mid-word
 * ("ol" does not hit "skole"). Lines are joined, so a phrase may cross a line
 * break. Chord names and section labels are never searched: entries carry
 * lyricsOnlyLines(body), not the body.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** A query longer than this is cut before it is keyed (D-090). */
export const SONG_SEARCH_MAX_LENGTH = 100;

/** What search needs of a song (the list page's SongbookEntry has more). */
export type SongSearchEntry = {
  id: string;
  title: string;
  artist: string | null;
  melody: string | null;
  /** lyricsOnlyLines(body). */
  lines: readonly string[];
};

export type SongSearchMode = "all" | "strict" | "loose";
/** [start, end) ranges in the original string's UTF-16 indices. */
export type HighlightRange = [number, number];
export type SongSnippet = { text: string; marks: HighlightRange[] };
export type SongMatch = { id: string; rank: number; snippet: SongSnippet | null };
export type SongSearchResult = { mode: SongSearchMode; matches: SongMatch[] };

const APOSTROPHES_RE = /['’‘´`′ʼ-]/g;

/** The strict search key: "Gi'r FANÖ-café!" → "gir fanøcafe". */
export function searchKey(text: string): string {
  return stripNul(text)
    .normalize("NFC")
    .toLocaleLowerCase("da")
    .replace(/[^\p{ASCII}æøå]/gu, (char) =>
      char === "ä" ? "æ" : char === "ö" ? "ø" : char.normalize("NFD").replace(/\p{M}/gu, ""),
    )
    .replace(APOSTROPHES_RE, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The loose key (fallback only): "Fanø" → "fano", "søen" → "son", "kære" → "kaere". */
export function looseKey(text: string): string {
  return searchKey(text)
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .replaceAll("oe", "o")
    .replaceAll("aa", "a");
}

type Keys = { title: string; artist: string; melody: string; lyrics: string; lines: string[] };
type IndexedSong = { entry: SongSearchEntry; strict: Keys; loose: Keys };
export type SongSearchIndex = readonly IndexedSong[];

function keysOf(entry: SongSearchEntry, key: (text: string) => string): Keys {
  const lines = entry.lines.map(key);
  return {
    title: key(entry.title),
    artist: key(entry.artist ?? ""),
    melody: key(entry.melody ?? ""),
    lyrics: lines.filter((line) => line !== "").join(" "),
    lines,
  };
}

/** Keys every entry once (about 2 ms for 60 songs). Memoise it per entry list. */
export function buildSongSearchIndex(entries: readonly SongSearchEntry[]): SongSearchIndex {
  return entries.map((entry) => ({
    entry,
    strict: keysOf(entry, searchKey),
    loose: keysOf(entry, looseKey),
  }));
}

/** `phrase` starts a word of `key` (keys are single-spaced). */
function startsWord(key: string, phrase: string): boolean {
  return key.startsWith(phrase) || key.includes(` ${phrase}`);
}

function rankOf(keys: Keys, q: string, words: string[], mode: "strict" | "loose"): number {
  if (keys.title.startsWith(q)) return 0;
  if (startsWord(keys.title, q)) return 1;
  if (q.length < 2) return -1;
  if (mode === "strict" && keys.title.includes(q)) return 2;
  if (startsWord(keys.artist, q) || startsWord(keys.melody, q)) return 3;
  if (startsWord(keys.lyrics, q)) return 4;
  if (words.length > 1) {
    const all = `${keys.title} ${keys.artist} ${keys.melody} ${keys.lyrics}`;
    if (words.every((word) => startsWord(all, word))) return 5;
  }
  return -1;
}

/** The lyric line to show under a rank 4–5 hit, or null. */
function snippetOf(
  song: IndexedSong,
  q: string,
  words: string[],
  mode: "strict" | "loose",
  query: string,
): SongSnippet | null {
  const keys = mode === "strict" ? song.strict : song.loose;
  let best = keys.lines.findIndex((line) => startsWord(line, q));
  if (best === -1) {
    // The line with the most query words; on a tie the one with the first word, then the earliest.
    let bestScore = 0;
    keys.lines.forEach((line, i) => {
      const found = words.filter((word) => startsWord(line, word)).length;
      const score = found * 2 + (words[0] !== undefined && startsWord(line, words[0]) ? 1 : 0);
      if (found > 0 && score > bestScore) [best, bestScore] = [i, score];
    });
  }
  const text = best === -1 ? undefined : song.entry.lines[best];
  return text === undefined ? null : { text, marks: highlightRanges(text, query, mode) };
}

function queryWords(query: string, key: (text: string) => string): string[] {
  const q = key(query.slice(0, SONG_SEARCH_MAX_LENGTH));
  return q === "" ? [] : q.split(" ");
}

/**
 * The songs matching `query`, best first. An empty query gives every song in
 * the given order (mode 'all'). When the strict search finds nothing, the
 * loose one runs, where every query word must start a word (mode 'loose':
 * the UI says "… hvis man ser bort fra æ, ø og å").
 */
export function matchSongs(index: SongSearchIndex, query: string): SongSearchResult {
  const strictWords = queryWords(query, searchKey);
  if (strictWords.length === 0) {
    return {
      mode: "all",
      matches: index.map((song) => ({ id: song.entry.id, rank: 0, snippet: null })),
    };
  }
  for (const mode of ["strict", "loose"] as const) {
    const words = mode === "strict" ? strictWords : queryWords(query, looseKey);
    const q = words.join(" ");
    if (q === "") continue;
    const ranked = index
      .map((song) => ({
        song,
        rank: rankOf(mode === "strict" ? song.strict : song.loose, q, words, mode),
      }))
      .filter(({ rank }) => rank >= 0);
    if (ranked.length === 0) continue;
    // Array.prototype.sort is stable: ties keep the book's order.
    ranked.sort((a, b) => a.rank - b.rank);
    return {
      mode,
      matches: ranked.map(({ song, rank }) => ({
        id: song.entry.id,
        rank,
        snippet: rank >= 4 ? snippetOf(song, q, words, mode, query) : null,
      })),
    };
  }
  return { mode: "strict", matches: [] };
}

/**
 * The words of `text` to mark for `query`: a word is marked when one of its
 * key parts starts with a query word (in a query of several words, a
 * 1-character word must equal the part, so "jeg i" does not mark every word
 * starting with "i"). Per word, so it survives apostrophes and accents; the
 * words of a phrase match are marked by the same rule. Use it for titles and
 * snippets alike. Render the ranges as <mark>, never with innerHTML.
 */
export function highlightRanges(
  text: string,
  query: string,
  mode: SongSearchMode = "strict",
): HighlightRange[] {
  const key = mode === "loose" ? looseKey : searchKey;
  const words = queryWords(query, key);
  if (words.length === 0) return [];
  const ranges: HighlightRange[] = [];
  for (const match of text.slice(0, 5000).matchAll(/\S+/g)) {
    const parts = key(match[0]).split(" ");
    const hit = parts.some((part) =>
      words.some((word) =>
        word.length === 1 && words.length > 1 ? part === word : part.startsWith(word),
      ),
    );
    if (hit) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}
