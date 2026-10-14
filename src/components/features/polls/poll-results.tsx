import { LockIcon } from "lucide-react";

import type { PollStatus } from "@/server/domain/polls/options";
import type { PollOptionView, PollView } from "@/server/polls/queries";

import { previewNoDateWorks, previewOptions, topCount } from "./ballot-preview";
import { DateVoteOption } from "./date-vote-option";
import { FixedOptionRow } from "./fixed-option-row";
import { PlaceVoteOption } from "./place-vote-option";
import { dateOptionModel, placeOptionModel, toPreviewVoter, viewerOf } from "./vote-form-model";
import type { OptionMarker } from "./vote-option-row";
import { VoteOptionRow } from "./vote-option-row";

export type PollResultsProps = { view: PollView; now: Date };

/**
 * The marker of a result row: the decided winner ("🏆 Vinder", AWAITING for
 * the decided category, CLOSED for both); the tied options while a choice is
 * pending ("🤝 Står lige"); the leader of a poll whose deadline has passed but
 * that is not closed yet. Nothing on a cancelled poll.
 */
function markerOf(option: PollOptionView, status: PollStatus): OptionMarker {
  if (status === "CANCELLED") return null;
  if (option.isWinner) return "winner";
  if (status === "AWAITING_DECISION" && option.isTied) return "tied";
  if (status === "OPEN" && option.isLeader) return "leader";
  return null;
}

/** The viewer's stored ticks. */
function ticks(options: readonly PollOptionView[]): Set<string> {
  return new Set(options.filter((option) => option.viewerTicked).map((option) => option.id));
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold tracking-tight text-olive">{children}</h3>;
}

/**
 * The results without inputs (SPEC §9.7.3–§9.7.6, D-014): every status other
 * than an open vote. The same rows as the vote form – counts, bars, who voted
 * for what – with "🏆 Vinder" and "🤝 Står lige". OPEN but past the deadline
 * (the lazy close failed or is pending): "Fristen er udløbet – afstemningen
 * lukkes 🔒" above the rows.
 */
export function PollResults({ view, now }: PollResultsProps) {
  const viewer = viewerOf(view);
  const expired = view.status === "OPEN" && now.getTime() >= view.deadline.getTime();
  // The stored state: the viewer is "saved" where they ticked.
  const dateModels = view.dates.map(dateOptionModel);
  const placeModels = view.places.map((option) => placeOptionModel(option, view.createdBy));
  const myDates = ticks(view.dates);
  const myPlaces = ticks(view.places);
  const dateRows = previewOptions({
    options: dateModels,
    viewerId: viewer.id,
    ticked: myDates,
    saved: myDates,
    mode: view.shape.DATE,
  });
  const placeRows = previewOptions({
    options: placeModels,
    viewerId: viewer.id,
    ticked: myPlaces,
    saved: myPlaces,
    mode: view.shape.PLACE,
  });
  const viewerSaidNone = view.myBallot?.noDateWorks ?? false;
  const noneRow = previewNoDateWorks({
    voters: view.noDateWorksVoters.map(toPreviewVoter),
    viewerId: viewer.id,
    ticked: viewerSaidNone,
    saved: viewerSaidNone,
    dateTop: topCount(dateRows),
  });
  const [fixedDate] = dateModels;
  const [fixedPlace] = placeModels;

  return (
    <section aria-labelledby="poll-results-heading" className="grid grid-cols-1 gap-6">
      <h2 id="poll-results-heading" className="text-xl font-bold tracking-tight text-olive">
        {view.status === "OPEN" ? "Stemmerne indtil nu" : "Resultatet"}
      </h2>

      {expired ? (
        <p className="flex items-start gap-2 rounded-xl border-2 border-amber bg-amber-tint px-4 py-3 font-semibold text-ink">
          <LockIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0">Fristen er udløbet – afstemningen lukkes 🔒</span>
        </p>
      ) : null}

      {view.shape.DATE === "vote" ? (
        <div className="grid min-w-0 grid-cols-1 gap-3">
          <SectionTitle>Hvornår?</SectionTitle>
          {view.dates.map((option, index) => {
            const model = dateModels[index];
            const row = dateRows[index];
            if (!model || !row) return null;
            return (
              <DateVoteOption
                key={option.id}
                id={`result-date-${option.id}`}
                option={model}
                row={row}
                viewer={viewer}
                marker={markerOf(option, view.status)}
              />
            );
          })}
          {noneRow.count > 0 ? (
            <div className="mt-1 border-t-2 border-dashed border-border pt-4">
              <VoteOptionRow
                id="result-none"
                kind="none"
                label="Ingen af datoerne passer"
                row={noneRow}
                viewer={viewer}
              />
            </div>
          ) : null}
        </div>
      ) : fixedDate ? (
        <FixedOptionRow category="DATE" label={fixedDate.srLabel ?? fixedDate.label} />
      ) : null}

      {view.shape.PLACE === "vote" ? (
        <div className="grid min-w-0 grid-cols-1 gap-3">
          <SectionTitle>Hvor?</SectionTitle>
          {view.places.map((option, index) => {
            const model = placeModels[index];
            const row = placeRows[index];
            if (!model || !row) return null;
            return (
              <PlaceVoteOption
                key={option.id}
                id={`result-place-${option.id}`}
                option={model}
                row={row}
                viewer={viewer}
                marker={markerOf(option, view.status)}
              />
            );
          })}
        </div>
      ) : fixedPlace ? (
        <FixedOptionRow category="PLACE" label={fixedPlace.label} meta={fixedPlace.meta} />
      ) : null}
    </section>
  );
}
