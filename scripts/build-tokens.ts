import { writeFileSync } from "node:fs";

import { renderTokenFiles } from "../src/styles/tokens/render";

// Kør `npm test` bagefter: kontrasttesten fanger par under WCAG AA (SPEC §13.2).
for (const [path, content] of Object.entries(renderTokenFiles())) {
  writeFileSync(path, content);
  console.log(`Skrev ${path}`);
}
