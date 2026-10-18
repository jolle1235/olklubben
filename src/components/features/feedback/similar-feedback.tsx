"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { feedbackHref } from "@/lib/routes";
import {
  findSimilarFeedback,
  type SimilarFeedbackCandidate,
} from "@/server/domain/feedback/similar";

import { voteNoun } from "./feedback-labels";
import { FeedbackStatusBadge } from "./feedback-status-badge";

/** How long typing must pause before the list updates. */
const DEBOUNCE_MS = 300;

export type SimilarFeedbackProps = {
  /** What is typed in "Titel" right now. */
  title: string;
  /** The newest reports (listSimilarCandidates), matched here in the browser (D-149). */
  candidates: readonly SimilarFeedbackCandidate[];
};

/**
 * "Findes den allerede?" under the title on "Ny rapport" (SPEC §9.9): up to 3
 * existing reports whose titles share words with the one being typed
 * (findSimilarFeedback, from 3 characters, after a short pause), each with
 * its status and 👍, so the user can give a 👍 instead of writing a duplicate.
 * The links open in a new tab, so the draft is kept. A polite live region
 * announces when suggestions appear.
 */
export function SimilarFeedback({ title, candidates }: SimilarFeedbackProps) {
  const headingId = useId();
  const [query, setQuery] = useState(title);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(title), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [title]);

  const similar = useMemo(() => findSimilarFeedback(query, candidates), [query, candidates]);

  return (
    <div aria-live="polite">
      {similar.length > 0 ? (
        <section
          aria-labelledby={headingId}
          className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-amber bg-amber-tint/60 px-4 py-3"
        >
          <h2 id={headingId} className="text-lg leading-tight text-olive">
            Findes den allerede?
          </h2>
          <p className="text-[0.95rem] text-ink">
            Giv hellere en 👍 på en rapport, der findes, end at skrive den igen.
          </p>
          <ul className="grid grid-cols-1 gap-1">
            {similar.map((candidate) => (
              <li key={candidate.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a
                  href={feedbackHref(candidate.id)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 min-w-0 items-center gap-1.5 font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber"
                >
                  <span className="min-w-0 break-words hyphens-auto">{candidate.title}</span>
                  <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
                  <span className="sr-only"> (åbner i en ny fane)</span>
                </a>
                <FeedbackStatusBadge status={candidate.status} />
                <span className="text-[0.95rem] whitespace-nowrap text-muted-foreground">
                  <span aria-hidden>👍 </span>
                  {candidate.voteCount}
                  <span className="sr-only"> {voteNoun(candidate.voteCount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
