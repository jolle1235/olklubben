"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Error boundary for club pages (SPEC §13.5, §15.1). Keeps the AppShell (the
 * club layout sits above this boundary). `retry` re-fetches the segment from
 * the server; `reset` would only re-render on the client.
 */
export default function ClubError({
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
    <ErrorState
      as="h1"
      action={
        <Button onClick={() => retry()}>
          <RotateCwIcon aria-hidden />
          Prøv igen
        </Button>
      }
      detail={error.digest ? `Fejlkode: ${error.digest}` : undefined}
    />
  );
}
