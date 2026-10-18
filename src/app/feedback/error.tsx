"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";

import { ReportErrorLink } from "@/components/features/feedback/report-error-link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Error boundary for the feedback pages (SPEC §13.5, §15.1). Keeps the shell
 * (the feedback layout sits above it). "Prøv igen" re-fetches the segment;
 * "Rapportér denne fejl" opens a bug report for this page (§9.9, D-150).
 */
export default function FeedbackError({
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
        <>
          <Button onClick={() => retry()}>
            <RotateCwIcon aria-hidden />
            Prøv igen
          </Button>
          <ReportErrorLink />
        </>
      }
      detail={error.digest ? `Fejlkode: ${error.digest}` : undefined}
    />
  );
}
