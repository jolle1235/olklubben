import { buildBrowserColors, buildCss, generateScales } from "./build";
import { themeDefinition } from "./themes";

/** De genererede filer (relativt til repo-roden). Står i .prettierignore. */
export const GENERATED_TOKEN_FILES = {
  css: "src/styles/tokens/tokens.css",
  browserColors: "src/styles/tokens/browser-colors.ts",
} as const;

/** Indholdet af de genererede filer ud fra palette.ts og themes.ts. */
export function renderTokenFiles(): Record<string, string> {
  const scales = generateScales();
  return {
    [GENERATED_TOKEN_FILES.css]: buildCss(themeDefinition, scales),
    [GENERATED_TOKEN_FILES.browserColors]: buildBrowserColors(themeDefinition, scales),
  };
}
