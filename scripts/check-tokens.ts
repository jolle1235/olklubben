import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { constants, palette } from "../src/styles/tokens/palette";

/**
 * Håndhæver reglerne i SPEC §13.2 og §13.3. Tailwind fejler ikke ved ukendte
 * utilities, så et gammelt navn ville ellers bare give ingen farve, størrelse
 * eller skygge.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const SCAN = ["src"];
const SKIP_DIRS = ["src/styles/tokens", "src/generated"];
/** Bevidst faste farver, fx logoet (D-162). */
const ALLOWED_COLOR_FILES = [
  "src/components/brand/logo.tsx",
  "src/components/features/auth/external-sign-in.tsx",
  "src/server/email/templates.ts",
];
/** Logoets ordmærke (D-162). */
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
  { name: "dark: (temaet skifter via tokens)", pattern: /(?<![\w-])dark:/g },
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
  {
    name: "modifier på en rolle (brug en rolle som -faint eller -hover fra themes.ts)",
    pattern: new RegExp(
      `(?<![\\w-])(?:${UTILITY_PREFIXES})-[a-z][a-z0-9-]*/(?:\\d+|\\[[^\\]]*\\]|\\([^)]*\\))(?![\\w-])`,
      "g",
    ),
  },
  {
    name: "Tailwind-skygge (brug en elevation fra themes.ts)",
    pattern: /(?<![\w-])(?:shadow|inset-shadow|drop-shadow)-(?:2xs|xs|sm|md|lg|xl|2xl)(?![\w-])/g,
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
