import { formatWeekdayDateTime } from "@/lib/format/date";
import type { PollView } from "@/server/polls/queries";

import { PollVoteFormFields } from "./poll-vote-form-fields";
import { voteFormModel } from "./vote-form-model";

export type PollVoteFormProps = {
  clubId: string;
  view: PollView;
  /** The request's time (never new Date() in a client render). */
  now: Date;
};

/**
 * The vote form (SPEC §9.7.3, D-136), rendered while isVotingOpen: the
 * <form id="stem"> with "Hvornår?" (checkboxes dateOptionIds + «Ingen af
 * datoerne passer mig»), "Hvor?" (radios placeOptionId), fixed categories as
 * info rows, the optimistic preview and [Gem min stemme]. Posts to
 * castBallotAction, which redirects with "Skål! Din stemme er gemt ✓".
 *
 * Server Component: it formats the texts (Copenhagen time, display names)
 * and keys the client form on the saved ballot, so it remounts with the
 * stored state after a save – but keeps an unsaved draft through the 30 s
 * auto-refresh (another member's vote only moves the counts).
 */
export function PollVoteForm({ clubId, view }: PollVoteFormProps) {
  const model = voteFormModel({
    clubId,
    view,
    deadlineLabel: formatWeekdayDateTime(view.deadline),
  });
  return <PollVoteFormFields key={view.myBallot?.updatedAt.toISOString() ?? "new"} model={model} />;
}
