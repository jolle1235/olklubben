import { defineConfig, mergeConfig } from "vitest/config";

import { loadItestEnv } from "./tests/integration/env.mjs";
import baseConfig from "./vitest.config.mjs";

/**
 * Integration tests (`npm run test:integration`): the real Server Actions,
 * Better Auth and Postgres, against the dedicated olklubben_itest database.
 * `npm test` stays database-free (its include is src/**\/*.test.ts).
 *
 * loadItestEnv() reads .env.test and throws before anything connects unless
 * the database name ends in "_itest" (tests/integration/env.mts).
 */
const itestEnv = loadItestEnv();

const config = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      env: itestEnv,
      globalSetup: "./tests/integration/global-setup.ts",
      // One database: test files run one at a time.
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);

// mergeConfig concatenates arrays; the integration run must not pick up the unit tests.
config.test = { ...config.test, include: ["tests/integration/**/*.itest.ts"] };

export default config;
