import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";

import { ACTION_ERROR_CODES, type ActionError } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type FormAlertTone = "error" | "success" | "info";

const TONES = {
  // danger-deep on danger-tint 6,95:1, olive-deep on olive-tint 10,83:1, harbor on harbor-tint 6,14:1.
  error: {
    role: "alert",
    Icon: CircleAlertIcon,
    className: "border-danger/30 bg-danger-tint text-danger-deep",
  },
  success: {
    role: "status",
    Icon: CircleCheckIcon,
    className: "border-olive/25 bg-olive-tint text-olive-deep",
  },
  info: {
    role: "status",
    Icon: InfoIcon,
    className: "border-harbor/25 bg-harbor-tint text-harbor",
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
        "flex gap-3 rounded-xl border px-4 py-3 text-[0.98rem] leading-snug",
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
