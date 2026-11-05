import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

export type SegmentedControlProps<T extends string> = {
  /** The group's accessible name. */
  label: string;
  options: readonly SegmentedOption<T>[];
  /** null shows none as chosen. */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Toggle buttons where one is chosen, iOS style (SPEC §13.4). Equal segments
 * let the marker slide with `translate`, without measuring. It renders only once
 * a value is chosen, so it never slides in after hydration.
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
