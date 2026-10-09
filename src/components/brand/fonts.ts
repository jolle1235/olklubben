import { Source_Sans_3, Zilla_Slab } from "next/font/google";

// SPEC §13.3: a characterful slab for headings and the big dates ("label" feel),
// a legible sans for body text and UI. Danish æ/ø/å are in the latin subset.
const zillaSlab = Zilla_Slab({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-zilla-slab",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

/** Put on <html>. globals.css maps the variables to `font-display` and `font-sans`. */
export const fontVariables = `${zillaSlab.variable} ${sourceSans.variable}`;
