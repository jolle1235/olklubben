import { buildBrowserColors, buildCss } from "./css";
import { generateScales } from "./scales";
import { themeDefinition } from "./themes";
import { capsTracking, textUtilities } from "./typography";

/** Relativt til repo-roden. Skal stå i .prettierignore. */
export const GENERATED_TOKEN_FILES = {
  css: "src/styles/tokens/tokens.css",
  browserColors: "src/styles/tokens/browser-colors.ts",
} as const;

export function renderTokenFiles(): Record<string, string> {
  const scales = generateScales();
  const typography = { textStyles: textUtilities(), capsTracking };
  return {
    [GENERATED_TOKEN_FILES.css]: buildCss(themeDefinition, scales, typography),
    [GENERATED_TOKEN_FILES.browserColors]: buildBrowserColors(themeDefinition, scales),
  };
}
