import type { Metadata } from "next";

import { FeedbackForm } from "@/components/features/feedback/feedback-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { newFeedbackHref } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { parseNewFeedbackParams } from "@/server/domain/feedback/new-params";
import { listSimilarCandidates } from "@/server/feedback/queries";

export const metadata: Metadata = { title: "Ny rapport" };

/**
 * Ny rapport (SPEC §9.9 "Opret feedback"): a bug or an idea, title,
 * description and, for a bug, the page. `?type=bug|feature` chooses the type
 * (Fejl by default) and `?page=` fills in the page – both read as strings
 * only, and the page goes through toFeedbackPagePath (no club id, query or
 * hash, E26, D-143). "Rapportér denne fejl" on the error pages links here.
 * The newest reports go to the form for "Findes den allerede?" (D-149).
 *
 * Never calls notFound() itself, so loading.tsx may sit next to it (D-065).
 */
export default async function NewFeedbackPage({ searchParams }: PageProps<"/feedback/new">) {
  const { type, page } = parseNewFeedbackParams(await searchParams);
  await requireUser({ returnTo: newFeedbackHref({ type, page }) });
  const candidates = await listSimilarCandidates();

  return (
    <>
      <PageHeader
        title="Ny rapport"
        description="Har du fundet en fejl eller fået en idé? Skriv den her."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <FeedbackForm
            mode="create"
            defaultType={type}
            defaultPage={page}
            candidates={candidates}
          />
        </CardContent>
      </Card>
    </>
  );
}
