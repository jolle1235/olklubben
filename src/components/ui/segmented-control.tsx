import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

export type SegmentedControlProps<T extends string> = {
  /** The group's accessible name, e.g. "Visning". */
  label: string;
  options: readonly SegmentedOption<T>[];
  /** The chosen option; null shows none as chosen (e.g. before hydration). */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A row of toggle buttons where exactly one is chosen (aria-pressed), e.g.
 * Tekst | Akkorder in the song reader and System | Lyst | Mørkt on Profil.
 * Every button is at least 44 px (SPEC §13.4).
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-11 shrink-0 overflow-hidden rounded-lg border border-primary bg-card",
        className,
      )}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-11 cursor-pointer px-4 text-base font-semibold transition-colors focus-visible:-outline-offset-4 disabled:cursor-default",
              pressed
                ? "bg-primary text-primary-foreground"
                : "text-primary-ink hover:bg-primary-subtle",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
