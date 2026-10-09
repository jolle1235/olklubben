import { cn } from "@/lib/utils";

/**
 * A field's error under its input. Give the input aria-describedby={id} and
 * aria-invalid, and move focus to the input when the error appears (SPEC
 * §15.2): the screen reader then reads the message as the input's description.
 * Deliberately not a live region, which would announce it twice.
 */
export function FieldError({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p id={id} className={cn("text-[0.95rem] font-semibold text-danger", className)}>
      {children}
    </p>
  );
}

/** A form-level error (fx rate limited, E18), announced by screen readers. */
export function FormError({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg bg-danger-tint px-4 py-3 text-[0.95rem] font-semibold text-danger",
        className,
      )}
    >
      {children}
    </p>
  );
}
