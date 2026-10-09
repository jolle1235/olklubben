"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

// Light theme only (SPEC §13.2), so no next-themes here. Toasts are olive pills
// with cream text (8,77:1); errors use danger with white text (6,54:1).
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
        success: <CircleCheckIcon className="size-5 text-amber" />,
        info: <InfoIcon className="size-5 text-on-dark-muted" />,
        warning: <TriangleAlertIcon className="size-5 text-amber-ink" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin text-amber" />,
      }}
      // Below the 64 px mobile top bar, so the olive toast stands out on cream.
      // Sonner applies it only up to 600 px; globals.css stretches it up to md,
      // where the top bar ends.
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 4.75rem)" }}
      style={
        {
          "--normal-bg": "var(--olive)",
          "--normal-text": "var(--cream)",
          "--normal-border": "var(--olive-soft)",
          "--success-bg": "var(--olive)",
          "--success-text": "var(--cream)",
          "--success-border": "var(--olive-soft)",
          "--info-bg": "var(--olive)",
          "--info-text": "var(--cream)",
          "--info-border": "var(--olive-soft)",
          "--warning-bg": "var(--amber-tint)",
          "--warning-text": "var(--ink)",
          "--warning-border": "var(--amber)",
          "--error-bg": "var(--danger)",
          "--error-text": "#ffffff",
          "--error-border": "var(--danger-deep)",
          "--border-radius": "calc(var(--radius) * 1.4)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: "Luk besked",
        classNames: {
          toast: "cn-toast font-sans text-base! shadow-[0_18px_40px_-16px_rgb(45_47_35/0.55)]!",
          description: "opacity-90",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
