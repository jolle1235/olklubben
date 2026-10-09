/**
 * Loads `.env*` files with exactly the same precedence as Next.js, so the Prisma
 * CLI, Playwright and standalone `tsx` scripts see the same values as the app:
 *
 *   NODE_ENV=test        → .env.test.local, .env.test, .env   (never .env.local)
 *   NODE_ENV=production  → .env.production.local, .env.local, .env.production, .env
 *   otherwise            → .env.development.local, .env.local, .env.development, .env
 *
 * Variables already present in process.env always win (Vercel, CI, shell).
 *
 * Usage: `import "../scripts/load-env";` as the FIRST import of a tsx script.
 * prisma.config.ts and playwright.config.ts already do this.
 */
import { loadEnvConfig } from "@next/env";

export function loadEnv(projectDir: string = process.cwd()): void {
  const dev = process.env.NODE_ENV !== "production";
  loadEnvConfig(projectDir, dev, { info: () => {}, error: console.error });
}

loadEnv();
