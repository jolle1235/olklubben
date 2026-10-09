import { useId } from "react";

import { FieldError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldShellProps = {
  label: string;
  /**
   * Adds "(valgfri)" or "(valgfrit)" to the label, in the gender of the field's
   * noun: "en sluttid" → valgfri, "et tema" → valgfrit.
   */
  optional?: "valgfri" | "valgfrit";
  hint?: React.ReactNode;
  /** Messages from the shared Zod schema (client or server). The first is shown. */
  errors?: readonly string[];
  className?: string;
};

type ControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

/**
 * Label + control + hint + error, wired for screen readers (SPEC §15.2,
 * D-056): aria-invalid, and aria-describedby pointing at the hint or the
 * error. The error replaces the hint.
 */
function FieldShell({
  label,
  optional,
  hint,
  errors,
  className,
  children,
}: FieldShellProps & { children: (control: ControlProps) => React.ReactNode }) {
  const id = useId();
  const controlId = `${id}-control`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const error = errors?.[0];
  const showHint = Boolean(hint) && !error;

  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={controlId}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">({optional})</span> : null}
      </Label>
      {children({
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : showHint ? hintId : undefined,
      })}
      {showHint ? (
        <p id={hintId} className="text-[0.95rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

type InputFieldProps = FieldShellProps &
  Omit<React.ComponentProps<"input">, "id" | "name" | "className"> & { name: string };

export function EventInputField({
  label,
  optional,
  hint,
  errors,
  className,
  ...inputProps
}: InputFieldProps) {
  return (
    <FieldShell label={label} optional={optional} hint={hint} errors={errors} className={className}>
      {(control) => <Input {...control} {...inputProps} />}
    </FieldShell>
  );
}

type TextareaFieldProps = FieldShellProps &
  Omit<React.ComponentProps<"textarea">, "id" | "name" | "className"> & { name: string };

export function EventTextareaField({
  label,
  optional,
  hint,
  errors,
  className,
  ...textareaProps
}: TextareaFieldProps) {
  return (
    <FieldShell label={label} optional={optional} hint={hint} errors={errors} className={className}>
      {(control) => <Textarea {...control} {...textareaProps} />}
    </FieldShell>
  );
}
