import { buildBrowserColors, buildCss } from "./css";
import { generateScales } from "./scales";
import { themeDefinition } from "./themes";
import { spacing } from "./spacing";
import { capsTracking, semanticTextUtilities, textUtilities } from "./typography";

/** Relativt til repo-roden. Skal stå i .prettierignore. */
export const GENERATED_TOKEN_FILES = {
  css: "src/styles/tokens/tokens.css",
  browserColors: "src/styles/tokens/browser-colors.ts",
} as const;

export function renderTokenFiles(): Record<string, string> {
  const scales = generateScales();
  const typography = {
    textStyles: textUtilities(),
    semanticTextStyles: semanticTextUtilities(),
    capsTracking,
  };
  return {
    [GENERATED_TOKEN_FILES.css]: buildCss(themeDefinition, scales, typography, spacing),
    [GENERATED_TOKEN_FILES.browserColors]: buildBrowserColors(themeDefinition, scales),
  };
}
