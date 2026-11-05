import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { fontVariables } from "@/components/brand/fonts";
import { FlashToast } from "@/components/features/flash-toast";
import { SongbookPrefsScript } from "@/components/features/songs/songbook-prefs-script";
import { ThemePrefsScript } from "@/components/features/theme/theme-prefs-script";
import { ThemedToaster } from "@/components/features/theme/themed-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s · Ølklubben", default: "Ølklubben" },
  description: "Klubbens digitale samlingspunkt: næste ølsmagning, øl, sange og afstemninger.",
  applicationName: "Ølklubben",
  // Installed on an iPhone, the page runs under the status bar's light text, so
  // every shell paints the frame colour there (SPEC §13.6).
  appleWebApp: { title: "Ølklubben", capable: true, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // The frame colour per theme; a choice on Profil overrides it (src/lib/theme-prefs.ts).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BROWSER_THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: BROWSER_THEME_COLOR.dark },
  ],
  colorScheme: "light dark",
  // Lets env(safe-area-inset-*) work, so the bottom nav clears the iPhone home indicator.
  viewportFit: "cover",
};

/**
 * <FlashToast /> shows the toast a Server Action's redirect asked for with
 * `?toast=` (src/lib/flash-toast.ts) on EVERY page, also outside a club, e.g.
 * "Du har forladt klubben." on /onboarding or another club (D-104). Its
 * Suspense boundary keeps useSearchParams() from making pages dynamic.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the head scripts set attributes on <html>
    // before React hydrates. It covers <html>'s own attributes only.
    <html lang="da" className={`${fontVariables} h-full`} suppressHydrationWarning>
      <head>
        {/* The colour theme, before the first paint. */}
        <ThemePrefsScript />
        {/* The songbook reader's font size and view, before the first paint. */}
        <SongbookPrefsScript />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <ThemedToaster />
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
