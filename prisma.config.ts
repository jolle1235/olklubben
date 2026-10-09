// Prisma 7 does not load .env files by itself. This import loads them with the
// same precedence as Next.js (.env.local in development, .env.test when
// NODE_ENV=test). It must stay the first import.
import "./scripts/load-env";

import { defineConfig } from "prisma/config";

import { assertMigrationUrlSafe, resolveMigrationUrl } from "./src/lib/migration-url";

// On Vercel: refuses DIRECT_URL on Preview deployments and a pooled migration
// URL, so a preview can never migrate production (SPEC §4.8). Runs for every
// Prisma command, including `prisma generate` in postinstall. No-op elsewhere.
assertMigrationUrlSafe();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Run by `prisma db seed` (npm run db:seed). Not run automatically by migrate.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection; Neon's pooled URL in
    // DATABASE_URL is only for the running app (SPEC §4.8). DIRECT_URL (local or
    // manual use), else DATABASE_URL_UNPOOLED (set per environment and per
    // Preview branch by Vercel's Neon integration), else DATABASE_URL (locally
    // the same database). See src/lib/migration-url.ts.
    // Read from process.env (not Prisma's env() helper) so `prisma generate`
    // (postinstall) still works on a fresh clone without any env file.
    // No TimeZone=UTC option needed here (unlike pgConfig, F-012): migrations send
    // no client-side timestamp parameters, and _prisma_migrations uses now().
    url: resolveMigrationUrl(),
  },
});
