"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";

/** Single-line text types that get the X to clear them by default (D-167). */
const CLEARABLE_TYPES = new Set([undefined, "text", "email", "search", "url", "tel"]);

type InputProps = React.ComponentProps<"input"> & {
  /**
   * The X that empties the field (D-167), for a quick fix after a typo. On by
   * default for single-line text types. Pass false where the field has its own
   * button on the right, or where its type changes (the wrapper would remount it).
   */
  clearable?: boolean;
};

/**
 * The X shows only while there is text: CSS (:placeholder-shown, hence the
 * " " fallback placeholder) decides, so it also follows uncontrolled fields,
 * form resets and autofill. Out of the tab order: Ctrl+A, Delete does the
 * same from the keyboard.
 */
function Input({
  className,
  type,
  placeholder,
  clearable = CLEARABLE_TYPES.has(type),
  ...props
}: InputProps) {
  const input = (
    <input
      type={type}
      data-slot="input"
      placeholder={clearable ? (placeholder ?? " ") : placeholder}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground outline-offset-1 transition-colors file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25",
        clearable && "peer pr-12 [&::-webkit-search-cancel-button]:appearance-none",
        className,
      )}
      {...props}
    />
  );
  if (!clearable) return input;

  return (
    <div className="relative">
      {input}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Ryd feltet"
        onClick={(event) => {
          const field = event.currentTarget.previousElementSibling;
          if (!(field instanceof HTMLInputElement)) return;
          // Native setter + input event, so React's onChange runs: field.value = ""
          // would be undone by React on a controlled field.
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
            field,
            "",
          );
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
        }}
        className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted-foreground peer-placeholder-shown:hidden peer-read-only:hidden peer-disabled:hidden hover:text-foreground"
      >
        <XIcon aria-hidden className="size-5" />
      </button>
    </div>
  );
}

export { Input };
