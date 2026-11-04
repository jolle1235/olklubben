import type { MetadataRoute } from "next";

import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";

/**
 * The web app manifest (SPEC §13.6): "Føj til hjemmeskærm" opens Ølklubben as
 * its own app, without the browser's address bar. The splash screen and the
 * status bar take the app frame's colour, like the top bar. The icons are the
 * logo (D-162), rasterised from src/app/icon.svg into public/icons; the
 * maskable one has the logo on the frame colour, inside the 80 % safe zone.
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
