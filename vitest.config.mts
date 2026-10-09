import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/*" alias from tsconfig.json (native in Vite 8, no plugin needed).
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside React Server Components. In unit tests, use
      // the package's own no-op entry so server modules can be imported.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
