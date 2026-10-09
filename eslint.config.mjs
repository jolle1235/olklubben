import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const DB_IMPORT_MESSAGE =
  "Ingen databaseadgang fra sider og Server Actions: brug src/server/<feature>/queries.ts eller mutations.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Layering (SPEC §4.2): pages and Server Actions never talk to Prisma
    // directly. Exceptions: src/server/auth/** and src/server/rate-limit.ts.
    files: ["src/app/**", "src/server/actions/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@/server/db", message: DB_IMPORT_MESSAGE }],
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
    "src/generated/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
