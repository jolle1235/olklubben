import { CircleAlertIcon } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { PasswordInput } from "./password-input";

export type AuthFieldProps = Omit<React.ComponentProps<"input">, "id" | "name"> & {
  name: string;
  label: string;
  /** Messages from the shared Zod schema (client or server). The first is shown. */
  errors?: readonly string[];
  /** Help text under the field, e.g. "Mindst 8 tegn." */
  hint?: React.ReactNode;
  /** Ids of other elements that describe the field, e.g. a form-level alert. */
  describedBy?: string;
  /** Marks the field invalid without its own message (the alert explains). */
  invalid?: boolean;
  /** Values the browser offers in the field (a <datalist>), e.g. emails used before. */
  suggestions?: readonly string[];
};

/**
 * Label + input + hint + error, wired for screen readers: aria-invalid and
 * aria-describedby point at the hint and the error message (SPEC §15.2).
 * type="password" gets a show/hide toggle.
 */
export function AuthField({
  name,
  label,
  errors,
  hint,
  describedBy,
  invalid,
  suggestions = [],
  type = "text",
  className,
  ...inputProps
}: AuthFieldProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const listId = `${id}-suggestions`;
  const error = errors?.[0];

  // The error replaces the hint ("Mindst 8 tegn." twice would be noise).
  const showHint = Boolean(hint) && !error;
  const describedByIds =
    [showHint ? hintId : null, error ? errorId : null, describedBy].filter(Boolean).join(" ") ||
    undefined;
  const controlProps = {
    id: inputId,
    name,
    "aria-invalid": Boolean(error) || invalid || undefined,
    "aria-describedby": describedByIds,
    list: suggestions.length > 0 ? listId : undefined,
    ...inputProps,
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {type === "password" ? (
        <PasswordInput {...controlProps} />
      ) : (
        <Input type={type} {...controlProps} />
      )}
      <Suggestions id={listId} values={suggestions} />
      {showHint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <CircleAlertIcon aria-hidden className="mt-px size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The field's <datalist>; nothing without values. */
function Suggestions({ id, values }: { id: string; values: readonly string[] }) {
  if (values.length === 0) return null;
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}
