"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export type GoogleSignInProps = {
  /** Where to land after Google: the safe ?next= path or "/" (§10.1). */
  callbackURL: string;
  /** Where a failed Google login lands (/login?error=…), keeping ?next=. */
  errorCallbackURL: string;
};

/**
 * "Fortsæt med Google" (SPEC §6.2) plus the "eller med email" divider. Only
 * rendered when Google is configured (isGoogleConfigured, decided on the server).
 * Creates the account or links it to an existing one (E19, handled by Better Auth).
 */
export function GoogleSignIn({ callbackURL, errorCallbackURL }: GoogleSignInProps) {
  return (
    <div className="grid gap-5">
      <GoogleSignInButton
        callbackURL={callbackURL}
        errorCallbackURL={errorCallbackURL}
        className="w-full"
      >
        Fortsæt med Google
      </GoogleSignInButton>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        eller med email
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export type GoogleSignInButtonProps = GoogleSignInProps & {
  /** Pre-selects this account in Google's chooser (fx "Log ind med Google igen", D-152). */
  loginHint?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * A button that sends the browser to Google (Better Auth's social sign-in),
 * with Google's "G" and a spinner while it leaves. Used by "Fortsæt med
 * Google" and by Profil's "Log ind med Google igen" (D-152). Only render it
 * when Google is configured.
 */
export function GoogleSignInButton({
  callbackURL,
  errorCallbackURL,
  loginHint,
  className,
  children,
}: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);

  // Coming back with the browser's back button restores this page from the
  // back/forward cache with the spinner still on. Reset it.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function signIn() {
    setPending(true);
    try {
      // On success the client sends the browser on to Google; keep the spinner.
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL,
        ...(loginHint ? { loginHint } : {}),
      });
      if (error) {
        setPending(false);
        toast.error(getAuthErrorMessage(error));
      }
    } catch {
      setPending(false);
      toast.error(getAuthErrorMessage(null));
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      onClick={signIn}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : <GoogleLogo />}
      {children}
    </Button>
  );
}

/** Google's "G" in its brand colours (required on Google sign-in buttons). */
function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z"
      />
    </svg>
  );
}
