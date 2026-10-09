/**
 * Text size for the club name in the sidebar's ClubSwitcher.
 *
 * The sidebar's name column is about 154 px wide: room for about 13
 * characters of Zilla Slab bold at text-lg, 15 at text-base and 17 at text-sm
 * (measured: "Æblemostklubben" is 159/147/126 px). A long single word would
 * otherwise be broken mid-word, so the size steps down with the longest word.
 * Names with short words keep text-lg and simply wrap (two lines at most);
 * anything longer still is hyphenated (hyphens-auto, lang="da").
 *
 * Pure and client-safe.
 */

export type ClubNameSize = "text-lg" | "text-base" | "text-sm";

/** The length of the longest whitespace-separated word, counted in characters (not UTF-16 units). */
export function longestWordLength(name: string): number {
  return name.split(/\s+/).reduce((longest, word) => Math.max(longest, Array.from(word).length), 0);
}

export function clubNameSize(name: string): ClubNameSize {
  const longest = longestWordLength(name);
  if (longest <= 13) return "text-lg";
  if (longest <= 15) return "text-base";
  return "text-sm";
}
