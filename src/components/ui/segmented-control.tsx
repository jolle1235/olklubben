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
  /** Default: while no option is chosen (value null). */
  disabled?: boolean;
  className?: string;
};

/**
 * A row of toggle buttons where exactly one is chosen (aria-pressed), e.g.
 * Tekst | Akkorder in the song reader and System | Lyst | Mørkt on Profil.
 * Every button is at least 44 px (SPEC §13.4).
 *
 * Like iOS, the segments are equally wide and the marker slides to the
 * chosen one (SPEC §13.4). The marker is one element moved with `translate`,
 * so it needs no measuring and is right from the server render; it only
 * appears once a value is chosen, so it never slides in from the first
 * segment after hydration.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = value === null,
  className,
}: SegmentedControlProps<T>) {
  const chosen = options.findIndex((option) => option.value === value);

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative isolate inline-grid h-11 shrink-0 auto-cols-fr grid-flow-col overflow-hidden rounded-lg border border-primary bg-card",
        className,
      )}
    >
      {chosen >= 0 ? (
        <span
          aria-hidden
          style={{ width: `${100 / options.length}%`, translate: `${chosen * 100}% 0` }}
          className="absolute inset-y-0 left-0 -z-10 bg-primary transition-[translate] duration-300 ease-spring"
        />
      ) : null}
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
              "min-w-11 cursor-pointer px-4 text-body-md font-semibold pressable-dim focus-visible:-outline-offset-4 disabled:cursor-default",
              pressed ? "text-primary-foreground" : "text-primary-ink hover:bg-primary-subtle",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
