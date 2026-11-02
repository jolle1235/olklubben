import { writeFileSync } from "node:fs";

import { renderTokenFiles } from "../src/styles/tokens/render";

/**
 * `npm run tokens`: genererer farvesystemets CSS (tokens.css) og browserens
 * temafarver (browser-colors.ts) ud fra src/styles/tokens/palette.ts og
 * themes.ts (SPEC §13.2). Kør det efter hver ændring dér, og kør derefter
 * `npm test`: kontrasttesten fanger par under WCAG AA, og build.test.ts
 * fejler, hvis de committede filer ikke matcher kilden.
 */
for (const [path, content] of Object.entries(renderTokenFiles())) {
  writeFileSync(path, content);
  console.log(`Skrev ${path}`);
}
