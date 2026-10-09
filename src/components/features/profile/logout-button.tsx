"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { withNext } from "@/lib/auth-links";
import { cn } from "@/lib/utils";

/**
 * "Log ud" (SPEC §9.8). Ends the session and goes to /login.
 * variant "outline": the button on Profil. "link": inline text, e.g. in the
 * "Logget ind som …" footer on onboarding pages.
 *
 * `next`: a same-origin path to come back to after logging in again, e.g. the
 * invitation on /join/<code> (someone on the wrong account, §6.5). It becomes
 * /login?next=…; an unsafe value is dropped.
 */
export function LogoutButton({
  className,
  variant = "outline",
  next,
}: {
  className?: string;
  variant?: "outline" | "link";
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
      router.replace(withNext("/login", next));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={logOut}
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(variant === "link" ? "min-h-11" : "w-full sm:w-auto", className)}
    >
      {pending ? (
        <Loader2Icon aria-hidden className="animate-spin" />
      ) : variant === "outline" ? (
        <LogOutIcon aria-hidden />
      ) : null}
      {pending ? "Logger ud …" : "Log ud"}
    </Button>
  );
}
