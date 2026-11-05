import type { MetadataRoute } from "next";

import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";

/**
 * SPEC §13.6. The icons are rasterised from src/app/icon.svg (D-162); the
 * maskable one keeps the logo inside the 80 % safe zone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ølklubben",
    short_name: "Ølklubben",
    description: "Klubbens digitale samlingspunkt: næste ølsmagning, øl, sange og afstemninger.",
    lang: "da",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BROWSER_THEME_COLOR.light,
    theme_color: BROWSER_THEME_COLOR.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
