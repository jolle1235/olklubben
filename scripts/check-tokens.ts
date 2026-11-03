import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { constants, palette } from "../src/styles/tokens/palette";

/**
 * `npm run check:tokens` (en del af `npm run check`): holder farvesystemet
 * (SPEC §13.2) og typeskalaen (§13.3) intakt. Komponenter må kun bruge
 * rollerne fra themes.ts og typography.ts. Fejler ved:
 *
 *   * farveværdier (hex, rgb(), hsl(), oklch() …) uden for src/styles/tokens/
 *   * primitiver (var(--olive-9), var(--white) …) uden for src/styles/tokens/
 *   * de gamle farvenavne fra før farvesystemet (bg-olive, text-ink,
 *     var(--cream), on-olive …)
 *   * en solid familiefarve som tekst (text-primary …): farvet tekst er
 *     {rolle}-ink, som er kontrasttestet på lyse flader i begge temaer
 *   * `dark:` i app- og feature-kode (temaet skifter via tokens; kun shadcn's
 *     primitiver i components/ui har dem)
 *   * Tailwinds egne skriftstørrelser (text-lg …) og vilkårlige størrelser,
 *     linjehøjder og tracking (text-[0.95rem], leading-[1.1], tracking-[0.1em]):
 *     brug en tekst-rolle (text-body-sm …) og `caps` til versaler
 *   * linjehøjder i komponenten (leading-tight …): rollen har sin egen, og
 *     ellers en -tight/-loose-variant (text-body-sm-tight). Kun leading-none
 *     er tilladt, til ét tal eller tegn i en boks
 *
 * Tailwind fejler ikke selv ved ukendte utilities (`--color-*: initial`,
 * `--text-*: initial`), så et gammelt navn ville ellers bare give ingen farve
 * eller størrelse.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const SCAN = ["src"];
const SKIP_DIRS = ["src/styles/tokens", "src/generated"];
/** Filer med bevidste, faste farver: logoet (D-162), Googles logo og e-mails. */
const ALLOWED_COLOR_FILES = [
  "src/components/brand/logo.tsx",
  "src/components/features/auth/external-sign-in.tsx",
  "src/server/email/templates.ts",
];
/** Filer med bevidste, faste skriftstørrelser: logoets ordmærke (D-162). */
const ALLOWED_TYPE_FILES = ["src/components/brand/logo.tsx"];

const OLD_NAMES = [
  "olive",
  "harbor",
  "cream",
  "paper",
  "amber",
  "brass",
  "ink",
  "slate",
  "sand",
  "rust",
  "brown",
  "danger",
  "on-dark-muted",
].join("|");
const UTILITY_PREFIXES = [
  "bg",
  "text",
  "border(?:-[trblxy])?",
  "ring",
  "ring-offset",
  "outline",
  "fill",
  "stroke",
  "decoration",
  "shadow",
  "from",
  "via",
  "to",
  "divide",
  "placeholder",
  "caret",
  "accent",
].join("|");
const PRIMITIVES = [
  ...Object.keys(palette).map((hue) => `${hue}-\\d{1,2}`),
  ...Object.keys(constants),
].join("|");

type Rule = {
  name: string;
  pattern: RegExp;
  /** Gælder ikke ALLOWED_COLOR_FILES. */
  colorValue?: boolean;
  /** Gælder ikke ALLOWED_TYPE_FILES. */
  typeValue?: boolean;
  /** Kun TS/TSX uden for components/ui (shadcn's primitiver). */
  appCodeOnly?: boolean;
};

const RULES: Rule[] = [
  {
    name: "farveværdi (brug en rolle fra themes.ts)",
    pattern:
      /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|(?<![a-zA-Z0-9-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g,
    colorValue: true,
  },
  {
    name: "primitiv (brug en rolle fra themes.ts)",
    pattern: new RegExp(`var\\(--(?:${PRIMITIVES})\\)`, "g"),
  },
  {
    name: "gammelt farvenavn",
    pattern: new RegExp(
      `(?<![\\w-])(?:${UTILITY_PREFIXES})-(?:${OLD_NAMES})(?:-[a-z]+)?(?:/\\d+)?(?![\\w-])|var\\(--(?:${OLD_NAMES})(?:-[a-z]+)?\\)|(?<![\\w-])on-(?:olive|harbor)(?![\\w-])`,
      "g",
    ),
  },
  {
    name: "solid familiefarve som tekst (brug {rolle}-ink)",
    pattern: /(?<![\w-])text-(?:primary|destructive|info|success)(?![\w-])/g,
  },
  { name: "dark: (temaet skifter via tokens)", pattern: /(?<![\w-])dark:/g, appCodeOnly: true },
  {
    name: "Tailwind-skriftstørrelse (brug en tekst-rolle fra typography.ts)",
    pattern: /(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g,
  },
  {
    name: "vilkårlig skriftstørrelse (brug en tekst-rolle fra typography.ts)",
    pattern: /(?<![\w-])text-\[(?:length:)?-?[\d.]+(?:rem|px)\]/g,
    typeValue: true,
  },
  {
    name: "vilkårlig linjehøjde eller tracking (tekst-rollen har dem; versaler: caps)",
    pattern: /(?<![\w-])(?:leading|tracking)-\[[^\]]*\]/g,
  },
  {
    name: "linjehøjde i komponenten (brug rollen eller dens -tight/-loose-variant)",
    pattern: /(?<![\w-])leading-(?:tight|snug|normal|relaxed|loose|\d+)(?![\w-])/g,
  },
];

function files(dir: string): string[] {
  const rel = path.relative(ROOT, dir);
  if (SKIP_DIRS.includes(rel)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const problems: string[] = [];
for (const file of SCAN.flatMap((dir) => files(path.join(ROOT, dir)))) {
  const rel = path.relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  for (const rule of RULES) {
    if (rule.colorValue && ALLOWED_COLOR_FILES.includes(rel)) continue;
    if (rule.typeValue && ALLOWED_TYPE_FILES.includes(rel)) continue;
    if (rule.appCodeOnly && (rel.startsWith("src/components/ui/") || rel.endsWith(".css"))) {
      continue;
    }
    lines.forEach((line, index) => {
      for (const match of line.matchAll(rule.pattern)) {
        problems.push(`${rel}:${index + 1}  ${rule.name}: ${match[0]}`);
      }
    });
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(
    `\n${problems.length} brud på farvesystemet eller typeskalaen (SPEC §13.2, §13.3).`,
  );
  process.exit(1);
}
console.log("Farvesystemet og typeskalaen er intakte.");
