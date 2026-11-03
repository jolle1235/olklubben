import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const DB_IMPORT_MESSAGE =
  "Ingen databaseadgang fra sider og Server Actions: brug src/server/<feature>/queries.ts eller mutations.ts.";

// cn from "cn" does not know the type scale's text roles and would drop
// text-title-sm next to text-primary-ink (SPEC §13.3).
const CN_IMPORT = {
  name: "cn",
  message: "Brug cn fra @/lib/utils: den kender typeskalaens tekst-roller (SPEC §13.3).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**"],
    ignores: ["src/lib/utils.ts"],
    rules: { "no-restricted-imports": ["error", { paths: [CN_IMPORT] }] },
  },
  {
    // Layering (SPEC §4.2): pages and Server Actions never talk to Prisma
    // directly. Exceptions: src/server/auth/** and src/server/rate-limit.ts.
    // Repeats CN_IMPORT: this block's options replace the one above.
    files: ["src/app/**", "src/server/actions/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@/server/db", message: DB_IMPORT_MESSAGE }, CN_IMPORT],
          patterns: [{ group: ["@/server/db/*"], message: DB_IMPORT_MESSAGE }],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project:
    ".next-e2e/**",
    // The orchestrator's git-ignored working files (plans, snapshots, scratch scripts).
    ".work/**",
    "src/generated/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
