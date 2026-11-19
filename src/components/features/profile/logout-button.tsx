"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { ROW_FRAME, RowContent, RowIcon } from "@/components/features/link-row";
import { clearDeviceCaches } from "@/components/features/pwa/device-cache";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { withNext } from "@/lib/auth-links";
import { cn } from "@/lib/utils";

/**
 * "Log ud" (SPEC §9.8). Ends the session, clears the device's cached pages
 * (D-185) and goes to /login. Google has no
 * session of ours to end, so the next "Fortsæt med Google" shows Google's
 * account chooser (prompt=select_account, D-180).
 * variant "link": inline text, e.g. in the
 * "Logget ind som …" footer on onboarding pages. "sidebar": a row under the
 * user in the desktop sidebar, so logging out needs no trip to Indstillinger.
 * "row": a row in Indstillinger's App group, styled like its link rows (D-184).
 *
 * `next`: a same-origin path to come back to after logging in again, e.g. the
 * invitation on /join/<code> (someone on the wrong account, §6.5). It becomes
 * /login?next=…; an unsafe value is dropped.
 */
export function LogoutButton({
  className,
  variant,
  next,
}: {
  className?: string;
  variant: "link" | "sidebar" | "row";
  next?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function logOut() {
    startTransition(async () => {
      try {
        const { error } = await authClient.signOut();
        if (error) throw error;
      } catch {
        toast.error("Kunne ikke logge dig ud. Prøv igen.");
        return;
      }
      await clearDeviceCaches();
      router.replace(withNext("/login", next));
      router.refresh();
    });
  }

  const label = pending ? "Logger ud …" : "Log ud";
  const buttonProps = {
    type: "button" as const,
    onClick: logOut,
    disabled: pending,
    "aria-busy": pending || undefined,
  };

  if (variant === "row") {
    return (
      <button
        {...buttonProps}
        className={cn(ROW_FRAME, "w-full cursor-pointer text-left disabled:cursor-wait", className)}
      >
        <RowContent
          leading={
            <RowIcon>
              {pending ? (
                <Loader2Icon className="animate-spin" strokeWidth={2.25} />
              ) : (
                <LogOutIcon strokeWidth={2.25} />
              )}
            </RowIcon>
          }
          title={label}
          trailing={null}
        />
      </button>
    );
  }

  if (variant === "sidebar") {
    return (
      <button
        {...buttonProps}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl pressable-row px-2.5 py-2 text-left font-semibold text-frame-muted-foreground hover:bg-frame-faint hover:text-frame-foreground disabled:cursor-wait",
          className,
        )}
      >
        <span aria-hidden className="grid size-8 shrink-0 place-items-center">
          {pending ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : (
            <LogOutIcon className="size-5" />
          )}
        </span>
        {label}
      </button>
    );
  }

  return (
    <Button {...buttonProps} variant={variant} className={cn("min-h-11", className)}>
      {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
