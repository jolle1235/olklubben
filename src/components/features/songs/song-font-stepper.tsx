"use client";

import { AArrowDownIcon, AArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { MAX_SONG_FONT_STEP } from "@/lib/songbook-prefs";
import { cn } from "@/lib/utils";

import { setSongFontStep, useSongFontStep } from "./use-songbook-prefs";

export type SongFontStepperProps = {
  /**
   * "topbar": two icon buttons in the frame colours in the mobile top bar (TopBarAction).
   * "toolbar": outline buttons in the reader's toolbar (md and up).
   */
  variant: "topbar" | "toolbar";
  className?: string;
};

/**
 * Mindre / større skrift in the reader (SPEC §9.6): 7 steps, 16–32 px,
 * remembered per device. Disabled at the ends and until hydrated (TG-020).
 */
export function SongFontStepper({ variant, className }: SongFontStepperProps) {
  const step = useSongFontStep();
  const hydrated = useHydrated();
  const buttonClass =
    variant === "topbar"
      ? "text-frame-foreground hover:bg-frame-hover hover:text-frame-foreground"
      : "border-input bg-card text-foreground hover:bg-muted";

  return (
    <div role="group" aria-label="Skriftstørrelse" className={cn("flex gap-1", className)}>
      <Button
        type="button"
        size="icon"
        variant={variant === "topbar" ? "ghost" : "outline"}
        aria-label="Mindre skrift"
        disabled={!hydrated || step <= 0}
        onClick={() => setSongFontStep(step - 1)}
        className={buttonClass}
      >
        <AArrowDownIcon aria-hidden className="size-6" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={variant === "topbar" ? "ghost" : "outline"}
        aria-label="Større skrift"
        disabled={!hydrated || step >= MAX_SONG_FONT_STEP}
        onClick={() => setSongFontStep(step + 1)}
        className={buttonClass}
      >
        <AArrowUpIcon aria-hidden className="size-6" />
      </Button>
    </div>
  );
}
