import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderTokenFiles } from "./render";

describe("de genererede token-filer", () => {
  it.each(Object.entries(renderTokenFiles()))(
    "%s matcher palette.ts, themes.ts og typography.ts (kør `npm run tokens`)",
    (path, content) => {
      expect(readFileSync(path, "utf8")).toBe(content);
    },
  );
});
