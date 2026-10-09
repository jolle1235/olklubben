"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";

import { CenteredShell } from "@/components/features/centered-shell";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

// Root error boundary (SPEC §13.5). `retry` re-fetches the segment from the server
// and re-renders it (Next.js 16.3+); `reset` would only re-render on the client.
export default function RootError({
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
  );
}
