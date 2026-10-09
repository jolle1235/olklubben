"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export type SubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "type" | "asChild"> & {
  /** Text while the form is submitting, e.g. "Gemmer …". Defaults to the normal label. */
  pendingLabel?: React.ReactNode;
  /** Force the pending state, e.g. from useActionState's isPending. */
  pending?: boolean;
};

/**
 * Submit button for <form action={…}>. Disabled with a spinner while the form is
 * pending (useFormStatus), so a double tap never submits twice. At least 44 px tall.
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  disabled,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = Boolean(pendingProp) || status.pending;

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
