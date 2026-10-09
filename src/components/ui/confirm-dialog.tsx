"use client";

import { useId, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/action-result";

/** SPEC §13.5 "Generisk fejl". */
const GENERIC_ERROR = DEFAULT_ERROR_MESSAGES.UNEXPECTED;

type ConfirmDialogBaseProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** Text on the confirm button while working. Defaults to confirmLabel. */
  pendingLabel?: React.ReactNode;
  /** Red confirm button for destructive actions. */
  destructive?: boolean;
  /**
   * Extra content between the text and the buttons. With `action`, this is
   * inside the <form>, so hidden inputs and fields (fx "skriv klubbens navn")
   * are submitted, and `required` fields are validated before the action runs.
   */
  children?: React.ReactNode;
  /** Runs after a successful confirm, when the dialog has closed. */
  onSuccess?: () => void;
  /** Keeps the confirm button disabled, fx until "skriv klubbens navn" matches. */
  confirmDisabled?: boolean;
};

/**
 * Who opens the dialog: its own `trigger`, or the parent (controlled `open`,
 * fx from a menu item; the dialog is then rendered outside the menu).
 */
type ConfirmDialogOpenProps =
  | {
      /** The element that opens the dialog, typically a <Button>. Rendered with asChild. */
      trigger: React.ReactElement;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }
  | {
      trigger?: undefined;
      open: boolean;
      /** Called with false on cancel, Escape and after a successful confirm. */
      onOpenChange: (open: boolean) => void;
    };

export type ConfirmDialogProps = ConfirmDialogBaseProps &
  ConfirmDialogOpenProps &
  (
    | {
        /** Async handler. Return `{ ok: false, error: { message } }` to show an error. */
        onConfirm: () => unknown;
        action?: never;
      }
    | {
        /** Server Action that receives the form data of `children`. Same result handling. */
        action: (formData: FormData) => unknown;
        onConfirm?: never;
      }
  );

/** Reads the error message from an action result shaped like SPEC §4.3. */
function getFailureMessage(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  if (!("ok" in result) || result.ok !== false) return null;
  const error = "error" in result ? result.error : undefined;
  if (typeof error === "object" && error !== null && "message" in error) {
    if (typeof error.message === "string" && error.message) return error.message;
  }
  return GENERIC_ERROR;
}

/**
 * Confirmation before destructive or important actions (SPEC §15.1).
 * Stays open with a spinner while the work runs, closes on success, and shows
 * the error inside the dialog on failure. Redirects from Server Actions work.
 * Uncontrolled with a `trigger`, or controlled with `open` + `onOpenChange`.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    trigger,
    title,
    description,
    confirmLabel,
    cancelLabel = "Annuller",
    pendingLabel,
    destructive = false,
    children,
    onSuccess,
    confirmDisabled = false,
    onConfirm,
    action,
    open: openProp,
    onOpenChange,
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const [error, setError] = useState<string | null>(null);
  // Every opening (own trigger or the parent's `open`) starts without the last error.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setError(null);
  }
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  function run(task: () => unknown) {
    setError(null);
    startTransition(async () => {
      try {
        const failure = getFailureMessage(await task());
        if (failure) {
          setError(failure);
          return;
        }
        setOpen(false);
        onSuccess?.();
      } catch (err) {
        // redirect()/notFound() from a Server Action must reach Next.js.
        unstable_rethrow(err);
        console.error(err);
        setError(GENERIC_ERROR);
      }
    });
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return; // no closing halfway through
    setOpen(next);
  }

  const confirmButton = (
    <Button
      type={action ? "submit" : "button"}
      form={action ? formId : undefined}
      variant={destructive ? "destructive" : "default"}
      disabled={isPending || confirmDisabled}
      aria-busy={isPending || undefined}
      onClick={onConfirm ? () => run(onConfirm) : undefined}
    >
      {isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
      {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
    </Button>
  );

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>

        {action ? (
          <form
            id={formId}
            className="grid gap-4 empty:hidden"
            onSubmit={(event) => {
              event.preventDefault();
              // Enter in a field must not get past a disabled confirm button.
              if (confirmDisabled) return;
              const formData = new FormData(event.currentTarget);
              run(() => action(formData));
            }}
          >
            {children}
          </form>
        ) : children ? (
          <div className="grid gap-4">{children}</div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-tint px-4 py-3 text-[0.95rem] font-semibold text-danger"
          >
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          {confirmButton}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
