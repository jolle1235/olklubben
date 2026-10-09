import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/components/brand/fonts";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s · Ølklubben", default: "Ølklubben" },
  description: "Klubbens digitale samlingspunkt: næste ølsmagning, øl, sange og afstemninger.",
  applicationName: "Ølklubben",
  appleWebApp: { title: "Ølklubben", capable: true, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Olive browser chrome, matching the top bar and sidebar (SPEC §13.2).
  themeColor: "#414437",
  colorScheme: "light",
  // Lets env(safe-area-inset-*) work, so the bottom nav clears the iPhone home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="da" className={`${fontVariables} h-full`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
