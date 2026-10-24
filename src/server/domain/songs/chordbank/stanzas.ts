import type { Block } from "./chordbank";

/**
 * Block clean-up and stanza heuristics, at IMPORT time only (never when a
 * song is shown): 30 of the printouts have no blank lines at all, so without
 * these the Tekst view would be one long block. Ported from the prototype's
 * extract.py.
 */

const BLANK = (src: string): Block => ({ kind: "blank", text: "", src });

function opensStanza(out: readonly Block[]): boolean {
  const last = out[out.length - 1];
  return last !== undefined && last.kind !== "blank" && last.kind !== "section";
}

/**
 * No blank right after a label or another blank; a label typed as the
 * "lyric" under a chord row goes above that row; no blank at the end.
 */
export function tidyBlocks(blocks: readonly Block[]): Block[] {
  const tidy: Block[] = [];
  for (const block of blocks) {
    const last = tidy[tidy.length - 1];
    if (block.kind === "blank" && (!last || last.kind === "blank" || last.kind === "section")) {
      continue;
    }
    if (block.kind === "section" && last && last.kind === "chord" && !last.spacer) {
      tidy.splice(tidy.length - 1, 0, block);
      continue;
    }
    tidy.push(block);
  }
  while (tidy.length > 0 && tidy[tidy.length - 1]?.kind === "blank") tidy.pop();
  return tidy;
}

/**
 * Heuristic 1: a chord-only sequence row (with ChordBank's spacer row) that
 * heads 3 or more lyric lines starts a stanza.
 */
export function addChordRowBreaks(blocks: readonly Block[]): { blocks: Block[]; added: number } {
  const out: Block[] = [];
  let added = 0;
  blocks.forEach((block, k) => {
    if (block.kind === "chord" && block.spacer && !block.positioned) {
      let run = 0;
      for (const next of blocks.slice(k + 1)) {
        if (next.kind !== "lyric") break;
        run += 1;
      }
      if (run >= 3 && opensStanza(out)) {
        out.push(BLANK("chord-row"));
        added += 1;
      }
    }
    out.push(block);
  });
  return { blocks: out, added };
}

function chorusKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, " ")
    .trim();
}

/**
 * Heuristic 2: a run of `minRun`+ lyric lines that occurs again later in the
 * song (a chorus) gets a stanza break before and after every occurrence.
 * Matched over the whole song, longest runs first, occurrences never
 * overlapping. A break goes before the chord or note rows heading the line.
 */
export function addChorusBreaks(
  blocks: readonly Block[],
  minRun = 3,
): { blocks: Block[]; added: number } {
  const idx = blocks.flatMap((block, i) => (block.kind === "lyric" ? [i] : []));
  const texts = idx.map((i) => chorusKey(blocks[i]?.text ?? ""));
  const n = texts.length;

  // Maximal repeated runs (that cannot be extended backwards).
  const runs: { k: number; i: number; j: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (i > 0 && texts[i - 1] === texts[j - 1]) continue;
      let k = 0;
      while (j + k < n && i + k < j && texts[i + k] === texts[j + k]) k += 1;
      if (k >= minRun) runs.push({ k, i, j });
    }
  }
  runs.sort((a, b) => b.k - a.k || a.i - b.i || a.j - b.j);

  const used: [number, number][] = [];
  const bounds = new Set<number>();
  const free = (a: number, b: number) => used.every(([u0, u1]) => b <= u0 || a >= u1);
  for (const { k, i, j } of runs) {
    for (const a of [i, j]) {
      if (free(a, a + k)) {
        used.push([a, a + k]);
        bounds.add(a);
        bounds.add(a + k);
      }
    }
  }

  const breaksBefore = new Set<number>();
  for (const b of bounds) {
    if (b <= 0 || b >= n) continue;
    let bi = idx[b] as number;
    while (bi > 0 && (blocks[bi - 1]?.kind === "chord" || blocks[bi - 1]?.kind === "note")) bi -= 1;
    breaksBefore.add(bi);
  }

  const out: Block[] = [];
  let added = 0;
  blocks.forEach((block, i) => {
    if (breaksBefore.has(i) && opensStanza(out)) {
      out.push(BLANK("chorus"));
      added += 1;
    }
    out.push(block);
  });
  return { blocks: out, added };
}
