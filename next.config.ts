import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The E2E server (playwright.config.ts) sets NEXT_DIST_DIR=.next-e2e so it can
  // run next to a normal `npm run dev` without fighting over .next/dev/lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Cache Components (and Partial Prefetching, which requires it) are deliberately
  // OFF. create-next-app 16.4 enables both by default, but every page in this app
  // is auth-gated and reads the session + database per request, so the classic
  // dynamic rendering model is simpler and the static shell gains little.
  // Revisit before upgrading to Next.js 17, where both become always-on.
  cacheComponents: false,

  // Development only: the "N" indicator sits top right, off the mobile bottom
  // nav and the form inputs (the default bottom left covers "Overblik").
  // The E2E server (playwright.config.ts sets E2E_SERVER=1) has none at all:
  // at 375 px it covers the TopBarAction button ("+", "Inviter"), so a mobile
  // test that taps it would hit the indicator instead (TG-009).
  devIndicators: process.env.E2E_SERVER === "1" ? false : { position: "top-right" },

  // Tailwind CSS v4 runs as a Turbopack loader (create-next-app 16.4 default),
  // not through PostCSS.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
