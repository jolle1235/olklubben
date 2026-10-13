import { cleanSingleLine, nameKey } from "@/lib/text";

/**
 * Song titles and the book's order (SPEC §9.6): titles 1–120 characters, one
 * song per title key and club (unique index songs_club_id_title_key_key),
 * always alphabetical in Danish order with letter headings.
 *
 *   * cleanSongTitle: how a title is stored (NUL removed, NFC, whitespace
 *     collapsed, trimmed). songTitleKey: what makes two titles the same song
 *     ("Skål for kaptajnen" ≡ " SKÅL FOR  KAPTAJNEN "), the shared nameKey
 *     rule (D-086, D-095), stored in songs.title_key.
 *   * compareSongTitles: Danish order (Æ Ø Å after Z, "Aa" as Å, numbers
 *     numerically), ignoring leading punctuation («, „, ', …), then exact
 *     spelling, then id. Only the SERVER sorts; the client keeps that order,
 *     so Node and browser ICU never disagree.
 *   * songIndexLetter: the letter heading. The greatest of A…Z Æ Ø Å that
 *     sorts at or before the title (same collator), else "#". So the groups
 *     are contiguous with the sort by construction: "Aa…" → Å, "Ü…" → Y,
 *     "Ä…" → Æ, "Ö…" → Ø, "É…" → E, a digit → #.
 *
 * Pure module: no Next.js, React or database imports. Client-safe; also used
 * by the importer and the seed.
 */

export const SONG_TITLE_MAX_LENGTH = 120;
export const SONG_ARTIST_MAX_LENGTH = 120;
export const SONG_MELODY_MAX_LENGTH = 120;

/** "  Skål  for kaptajnen " → "Skål for kaptajnen". */
export function cleanSongTitle(title: string): string {
  return cleanSingleLine(title);
}

/** "Skål for kaptajnen", " SKÅL FOR  KAPTAJNEN " → "skålforkaptajnen". "" for an empty title. */
export function songTitleKey(title: string): string {
  return nameKey(title);
}

/** True when both are titles (not empty) of the same song. */
export function isSameSongTitle(a: string, b: string): boolean {
  const key = songTitleKey(a);
  return key !== "" && key === songTitleKey(b);
}

/** The title without leading punctuation and spaces: "«Skål»" → "Skål»", "'Fem små'" → "Fem små'". */
export function titleSortKey(title: string): string {
  const key = title.replace(/^[^\p{L}\p{N}]+/u, "");
  return key === "" ? title : key;
}

// Case and accents only break ties (sensitivity "base"); numbers in numeric order.
const collator = new Intl.Collator("da", { sensitivity: "base", numeric: true });
const tieBreaker = new Intl.Collator("da", { numeric: true });

type TitledSong = { id: string; title: string };

/** Danish book order: sort key, then the full title, then id, so the order never flickers. */
export function compareSongTitles(a: TitledSong, b: TitledSong): number {
  return (
    collator.compare(titleSortKey(a.title), titleSortKey(b.title)) ||
    tieBreaker.compare(a.title, b.title) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** A sorted copy (compareSongTitles). */
export function sortSongs<T extends TitledSong>(songs: readonly T[]): T[] {
  return [...songs].sort(compareSongTitles);
}

/** The letter headings in book order: "#" (numbers and the like) first, Æ Ø Å last. */
export const SONGBOOK_LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Æ", "Ø", "Å"] as const;

export type SongbookLetter = (typeof SONGBOOK_LETTERS)[number];

const LETTERS = SONGBOOK_LETTERS.slice(1) as readonly Exclude<SongbookLetter, "#">[];

/** The letter heading a title files under ("Aalborg…" → "Å", "7 små…" → "#"). */
export function songIndexLetter(title: string): SongbookLetter {
  const key = titleSortKey(title);
  let letter: SongbookLetter = "#";
  for (const candidate of LETTERS) {
    if (collator.compare(candidate, key) <= 0) letter = candidate;
    else break;
  }
  return letter;
}

const ANCHOR_SUFFIX: Partial<Record<SongbookLetter, string>> = {
  "#": "tal",
  Æ: "ae",
  Ø: "oe",
  Å: "aa",
};

/** The id of a letter heading: "bogstav-a" … "bogstav-ae", "bogstav-oe", "bogstav-aa", "bogstav-tal". */
export function letterAnchorId(letter: SongbookLetter): string {
  return `bogstav-${ANCHOR_SUFFIX[letter] ?? letter.toLowerCase()}`;
}

/**
 * Songs SORTED with compareSongTitles → one group per letter, in order. Each
 * song needs its `letter` (songIndexLetter(title), set by the server).
 */
export function groupSongsByLetter<T extends { letter: SongbookLetter }>(
  sorted: readonly T[],
): { letter: SongbookLetter; songs: T[] }[] {
  const groups: { letter: SongbookLetter; songs: T[] }[] = [];
  for (const song of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.letter === song.letter) last.songs.push(song);
    else groups.push({ letter: song.letter, songs: [song] });
  }
  return groups;
}

/**
 * Forrige/næste sang in the WHOLE book (not a search), without wrapping: the
 * first song has no previous, the last no next. Both null for an unknown id.
 */
export function songNeighbours<T extends { id: string }>(
  sorted: readonly T[],
  id: string,
): { previous: T | null; next: T | null } {
  const index = sorted.findIndex((song) => song.id === id);
  if (index === -1) return { previous: null, next: null };
  return { previous: sorted[index - 1] ?? null, next: sorted[index + 1] ?? null };
}
