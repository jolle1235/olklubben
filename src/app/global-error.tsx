"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";

import { fontVariables } from "@/components/brand/fonts";
import { CenteredShell } from "@/components/features/centered-shell";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import "./globals.css";

// Replaces the root layout when it fails, so it brings its own <html>, fonts and styles.
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

  return (
    <html lang="da" className={`${fontVariables} h-full`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <title>Noget gik galt · Ølklubben</title>
        <CenteredShell>
          <ErrorState
            as="h1"
            className="border-0 bg-transparent p-0 md:p-0"
            action={
              <Button onClick={() => retry()}>
                <RotateCwIcon aria-hidden />
                Prøv igen
              </Button>
            }
            detail={error.digest ? `Fejlkode: ${error.digest}` : undefined}
          />
        </CenteredShell>
      </body>
    </html>
  );
}
