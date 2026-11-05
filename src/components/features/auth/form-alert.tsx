import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";

import { ACTION_ERROR_CODES, type ActionError } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type FormAlertTone = "error" | "success" | "info";

const TONES = {
  error: {
    role: "alert",
    Icon: CircleAlertIcon,
    className: "border-destructive-border bg-destructive-subtle text-destructive-ink",
  },
  success: {
    role: "status",
    Icon: CircleCheckIcon,
    className: "border-success-border bg-success-subtle text-success-ink",
  },
  info: {
    role: "status",
    Icon: InfoIcon,
    className: "border-info-border bg-info-subtle text-info-ink",
  },
} as const;

export type FormAlertProps = {
  tone?: FormAlertTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
};

/** A message box above or inside a form: errors (role="alert"), success and info notes. */
export function FormAlert({ tone = "error", title, children, id, className }: FormAlertProps) {
  const { role, Icon, className: toneClassName } = TONES[tone];
  return (
    <div
      id={id}
      role={role}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-body-md-tight",
        toneClassName,
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="grid min-w-0 gap-1">
        {title ? <p className="font-bold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/**
 * A failed Server Action's message. Rate limiting gets a friendly heading;
 * `children` replaces the message when the form adds links (e.g. "Log ind i stedet").
 */
export function ActionErrorAlert({
  error,
  id,
  children,
}: {
  error: ActionError;
  id?: string;
  children?: React.ReactNode;
}) {
  const title = error.code === ACTION_ERROR_CODES.RATE_LIMITED ? "Rolig nu 🍺" : undefined;
  return (
    <FormAlert id={id} title={title}>
      {children ?? error.message}
    </FormAlert>
  );
}
