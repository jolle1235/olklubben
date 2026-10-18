"use client";

import { useOptimistic, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/action-result";
import { setFeedbackVoteAction } from "@/server/actions/feedback";
import type { FeedbackType } from "@/server/domain/feedback/status";

import { feedbackVoteLabel, voteNoun } from "./feedback-labels";

export type UpvoteButtonProps = {
  feedbackId: string;
  type: FeedbackType;
  /** The viewer's 👍 as the server knows it. */
  voted: boolean;
  /** 1 (the author) + the votes (computed, §3.4). */
  voteCount: number;
};

/**
 * The 👍 on a report (SPEC §9.9 "Stem op"), for everyone but its author:
 * "👍 Jeg har også det problem" (Fejl) / "👍 Det vil jeg også gerne have"
 * (Idé), and "Fjern min 👍" once given.
 *
 * Optimistic (§13.4.6), like the place-owner toggle (D-115): the count and
 * the label change at once and the action gets the desired state, so a double
 * tap is harmless; a failure rolls back with an error toast. The label says
 * what the button does, so no aria-pressed. The count is a polite live region,
 * so the new number is read out.
 */
export function UpvoteButton({ feedbackId, type, voted, voteCount }: UpvoteButtonProps) {
  const [shown, setOptimistic] = useOptimistic({ voted, voteCount });
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !shown.voted;
    startTransition(async () => {
      setOptimistic({ voted: next, voteCount: shown.voteCount + (next ? 1 : -1) });
      try {
        const result = await setFeedbackVoteAction({ feedbackId, voted: next });
        if (!result.ok) toast.error(result.error.message);
      } catch (error) {
        // A stale session redirects to /login; a deleted report gives a 404.
        unstable_rethrow(error);
        console.error(error);
        toast.error(DEFAULT_ERROR_MESSAGES.UNEXPECTED);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p
        aria-live="polite"
        aria-atomic="true"
        className="font-heading text-2xl leading-none font-bold whitespace-nowrap text-olive"
      >
        <span aria-hidden>👍 </span>
        {shown.voteCount}
        <span className="sr-only"> {voteNoun(shown.voteCount)}</span>
      </p>
      <Button type="button" variant={shown.voted ? "ghost" : "outline"} onClick={toggle}>
        {feedbackVoteLabel(type, shown.voted)}
      </Button>
    </div>
  );
}
