import { useId } from "react";

import { FieldError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Form fields for useActionForm (TG-021), wired for screen readers (SPEC
 * §15.2, D-056): aria-invalid, and aria-describedby pointing at the hint or
 * the error. The error replaces the hint. Messages come from the shared Zod
 * schema (client or server); the first is shown. The auth pages keep their
 * own AuthField look.
 */

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

export type FieldControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

function OptionalMark({ optional }: { optional?: "valgfri" | "valgfrit" }) {
  return optional ? <span className="font-normal text-muted-foreground">({optional})</span> : null;
}

function describe(id: string, hint: React.ReactNode, error: string | undefined) {
  const showHint = Boolean(hint) && !error;
  return {
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
    showHint,
    describedBy: error ? `${id}-error` : showHint ? `${id}-hint` : undefined,
  };
}

/** Label + any control + hint + error. The control gets its ids from `children(control)`. */
export function FieldShell({
  label,
  optional,
  hint,
  errors,
  className,
  children,
}: FieldShellProps & { children: (control: FieldControlProps) => React.ReactNode }) {
  const id = useId();
  const controlId = `${id}-control`;
  const error = errors?.[0];
  const { hintId, errorId, showHint, describedBy } = describe(id, hint, error);

  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={controlId}>
        {label}
        <OptionalMark optional={optional} />
      </Label>
      {children({
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
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

export function InputField({
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

export function TextareaField({
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

type CheckboxFieldProps = Omit<FieldShellProps, "optional" | "label"> & {
  label: React.ReactNode;
} & Omit<React.ComponentProps<"input">, "id" | "name" | "className" | "type"> & { name: string };

/**
 * A native checkbox (works before hydration) with its label beside it. The
 * whole row is the 44 px touch target; hint and error line up with the text.
 */
export function CheckboxField({
  label,
  hint,
  errors,
  className,
  ...inputProps
}: CheckboxFieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const error = errors?.[0];
  const { hintId, errorId, showHint, describedBy } = describe(id, hint, error);

  return (
    <div className={cn("grid content-start gap-1", className)}>
      <label
        htmlFor={controlId}
        className="flex min-h-11 cursor-pointer items-center gap-3 text-base leading-snug text-ink"
      >
        <input
          type="checkbox"
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
          {...inputProps}
        />
        <span className="min-w-0 break-words hyphens-auto">{label}</span>
      </label>
      {showHint ? (
        <p id={hintId} className="pl-8 text-[0.95rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <FieldError id={errorId} className="pl-8">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}

type ChoiceFieldsetProps = {
  legend: React.ReactNode;
  optional?: "valgfri" | "valgfrit";
  hint?: React.ReactNode;
  errors?: readonly string[];
  className?: string;
  /** The choices: native radios or checkboxes sharing one name. */
  children: React.ReactNode | ((control: Omit<FieldControlProps, "id">) => React.ReactNode);
};

/**
 * A group of choices (radio cards, checkbox chips): fieldset + legend, with
 * the hint or error right under the legend. The group carries the
 * description; with the render-prop form each control carries it instead (not
 * both, which would be read twice), so the error is read out when focus lands
 * on a choice (focusFirstInvalid picks the checked radio, else the first one).
 */
export function ChoiceFieldset({
  legend,
  optional,
  hint,
  errors,
  className,
  children,
}: ChoiceFieldsetProps) {
  const id = useId();
  const error = errors?.[0];
  const { hintId, errorId, showHint, describedBy } = describe(id, hint, error);
  const control = {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
  };

  return (
    <fieldset
      aria-describedby={typeof children === "function" ? undefined : describedBy}
      className={cn("grid min-w-0 content-start gap-2", className)}
    >
      <legend className="mb-2 flex items-center gap-2 text-[0.95rem] leading-tight font-semibold text-ink">
        {legend}
        <OptionalMark optional={optional} />
      </legend>
      {showHint ? (
        <p id={hintId} className="text-[0.95rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {typeof children === "function" ? children(control) : children}
    </fieldset>
  );
}
