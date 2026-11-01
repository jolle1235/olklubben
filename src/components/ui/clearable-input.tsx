"use client";

import { XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * An Input with an X that empties it (D-167), for a quick fix after a typo.
 * The X shows only while there is text: CSS (:placeholder-shown, hence the
 * " " fallback placeholder) decides, so it also follows uncontrolled fields,
 * form resets and autofill. Clearing goes through the native setter and an
 * input event, so React's onChange runs for controlled fields too. Out of the
 * tab order: Ctrl+A, Delete does the same from the keyboard.
 */
export function ClearableInput({
  className,
  placeholder,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <Input
        placeholder={placeholder ?? " "}
        className={cn("peer pr-12 [&::-webkit-search-cancel-button]:appearance-none", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Ryd feltet"
        onClick={(event) => {
          const input = event.currentTarget.previousElementSibling;
          if (!(input instanceof HTMLInputElement)) return;
          // input.value = "" would be undone by React on a controlled field.
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
            input,
            "",
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }}
        className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-slate peer-placeholder-shown:hidden peer-read-only:hidden peer-disabled:hidden hover:text-ink"
      >
        <XIcon aria-hidden className="size-5" />
      </button>
    </div>
  );
}
