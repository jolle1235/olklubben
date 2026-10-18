"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BugIcon, RotateCwIcon } from "lucide-react";

import { fontVariables } from "@/components/brand/fonts";
import { CenteredShell } from "@/components/features/centered-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { newFeedbackHref } from "@/lib/routes";
import "./globals.css";

const subscribeNever = () => () => {};

// Replaces the root layout when it fails, so it brings its own <html>, fonts and styles.
// "Rapportér denne fejl" (§9.9, D-150) is a plain <a>: the router may be what failed.
// Its page comes from window.location after hydration (none on the server render);
// newFeedbackHref drops the club id, query and hash. The digest never goes in the URL.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const pathname = useSyncExternalStore(
    subscribeNever,
    () => window.location.pathname,
    () => null,
  );

  return (
    <html lang="da" className={`${fontVariables} h-full`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <title>Noget gik galt · Ølklubben</title>
        <CenteredShell>
          <ErrorState
            as="h1"
            className="border-0 bg-transparent p-0 md:p-0"
            action={
              <>
                <Button onClick={() => retry()}>
                  <RotateCwIcon aria-hidden />
                  Prøv igen
                </Button>
                <a
                  href={newFeedbackHref({ type: "BUG", page: pathname })}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <BugIcon aria-hidden />
                  Rapportér denne fejl
                </a>
              </>
            }
            detail={error.digest ? `Fejlkode: ${error.digest}` : undefined}
          />
        </CenteredShell>
      </body>
    </html>
  );
}
