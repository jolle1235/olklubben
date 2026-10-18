"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BugIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { newFeedbackHref } from "@/lib/routes";

/**
 * "Rapportér denne fejl" on the error boundaries (SPEC §9.9 "Hvor finder man
 * det?", D-150): opens "Ny rapport" with Fejl chosen and the page filled in.
 * newFeedbackHref runs the path through toFeedbackPagePath, so the club id,
 * the query and the hash never reach the URL (E26, D-143). The error digest
 * is never part of it. An outline button next to the primary "Prøv igen".
 */
export function ReportErrorLink() {
  const pathname = usePathname();
  return (
    <Button asChild variant="outline">
      <Link href={newFeedbackHref({ type: "BUG", page: pathname })}>
        <BugIcon aria-hidden />
        Rapportér denne fejl
      </Link>
    </Button>
  );
}
