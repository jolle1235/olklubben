import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { fontVariables } from "@/components/brand/fonts";
import { FlashToast } from "@/components/features/flash-toast";
import { HeadScript } from "@/components/features/head-script";
import { ThemePrefsScript } from "@/components/features/theme/theme-prefs-script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SONGBOOK_PREFS_BOOTSTRAP } from "@/lib/songbook-prefs";
import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s · Ølklubben", default: "Ølklubben" },
  description: "Klubbens digitale samlingspunkt: næste ølsmagning, øl, sange og afstemninger.",
  applicationName: "Ølklubben",
  appleWebApp: { title: "Ølklubben", capable: true, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Browser chrome in the app frame's colour (top bar, sidebar), per theme (SPEC §13.2).
  // The theme bootstrap re-points it when the choice on Profil differs from the system.
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
    // suppressHydrationWarning: the bootstraps below set data-theme,
    // data-song-size and data-song-view on <html> before React hydrates. It
    // covers <html>'s own attributes only.
    <html lang="da" className={`${fontVariables} h-full`} suppressHydrationWarning>
      <head>
        {/* The colour theme, before the first paint (no flash of the wrong theme). */}
        <ThemePrefsScript />
        {/* The songbook reader's font size and view, before the first paint. */}
        <HeadScript code={SONGBOOK_PREFS_BOOTSTRAP} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
