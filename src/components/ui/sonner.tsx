"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

// Toasts are pills in the app frame's colours (SPEC §13.2); errors use the
// destructive role. The colours come from the colour system's roles, so they
// follow the light and dark theme without next-themes; contrast is tested in
// src/styles/tokens/contrast.test.ts. The highlight border sets them off on
// the frame band of CenteredShell pages, where "club-left"/"club-deleted"
// land (TG-039), as well as on the page background.
// Top-center on all screens, so toasts never hide behind the mobile bottom nav.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      duration={4000}
      containerAriaLabel="Beskeder"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5 text-highlight" />,
        info: <InfoIcon className="size-5 text-frame-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-5 text-highlight-ink" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin text-highlight" />,
      }}
      // Below the 64 px mobile top bar, so the toast stands out on the page background.
      // Sonner applies it only up to 600 px; globals.css stretches it up to md,
      // where the top bar ends.
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 4.75rem)" }}
      style={
        {
          "--normal-bg": "var(--frame)",
          "--normal-text": "var(--frame-foreground)",
          "--normal-border": "var(--highlight)",
          "--success-bg": "var(--frame)",
          "--success-text": "var(--frame-foreground)",
          "--success-border": "var(--highlight)",
          "--info-bg": "var(--frame)",
          "--info-text": "var(--frame-foreground)",
          "--info-border": "var(--highlight)",
          "--warning-bg": "var(--highlight-subtle)",
          "--warning-text": "var(--foreground)",
          "--warning-border": "var(--highlight)",
          "--error-bg": "var(--destructive)",
          "--error-text": "var(--destructive-foreground)",
          "--error-border": "var(--destructive-hover)",
          "--border-radius": "calc(var(--radius) * 1.4)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: "Luk besked",
        classNames: {
          toast: "cn-toast font-sans text-body-md! shadow-floating!",
          description: "opacity-90",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
