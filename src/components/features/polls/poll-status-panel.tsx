import { getDisplayName } from "@/lib/format/display-name";
import type { PollCategory } from "@/server/domain/polls/options";
import type { PollDateOptionView, PollPlaceOptionView, PollView } from "@/server/polls/queries";

import { CancelledPollBanner } from "./cancelled-poll-banner";
import {
  decidedCategoryLabel,
  NO_VOTES_NOTE,
  optionCountLabel,
  PAST_DATE_HINT,
  PAST_TIED_DATE_HINT,
  tieChoiceLegend,
  tiedOptionsLabel,
  tieWaitingNote,
} from "./decision-labels";
import { PollOutcome } from "./poll-outcome";
import { pollDateLabel, pollDateLongLabel, tieHeadline } from "./poll-labels";
import { TieResolver, type TieGroup } from "./tie-resolver";

export type PollStatusPanelProps = {
  clubId: string;
  view: PollView;
  /** canManagePoll(membership, view, user.id). */
  canManage: boolean;
  now: Date;
};

/**
 * The poll's state once voting has ended (SPEC §9.7.4–§9.7.7), between the
 * header and the results:
 *
 *   OPEN               → nothing (the vote form is the page).
 *   AWAITING_DECISION  → the tie card: what is tied (and what is decided),
 *                        "Ingen nåede at stemme 🦗" (E9), and the TieResolver
 *                        for the creator and admins – everyone else is told
 *                        who will choose (E11).
 *   CLOSED             → PollOutcome ("🎉 Afstemningen er afsluttet!").
 *   CANCELLED          → the cancelled banner.
 */
export function PollStatusPanel({ clubId, view, canManage, now }: PollStatusPanelProps) {
  switch (view.status) {
    case "OPEN":
      return null;
    case "AWAITING_DECISION":
      return <TieCard clubId={clubId} view={view} canManage={canManage} now={now} />;
    case "CLOSED":
      return <PollOutcome clubId={clubId} view={view} now={now} />;
    case "CANCELLED":
      return <CancelledPollBanner view={view} now={now} />;
  }
}

type AnyOption = PollDateOptionView | PollPlaceOptionView;

function optionsOf(view: PollView, category: PollCategory): AnyOption[] {
  return category === "DATE" ? view.dates : view.places;
}

function optionLabel(option: AnyOption): string {
  if ("startsAt" in option) return pollDateLabel(option.startsAt);
  return option.place.archived ? `${option.place.name} (arkiveret)` : option.place.name;
}

function tiedOptions(view: PollView, category: PollCategory): AnyOption[] {
  return optionsOf(view, category).filter((option) => option.isTied);
}

/** E33: the date the event would get is over (decided), or one of the tied ones is. */
function pastDateHint(view: PollView, now: Date): string | null {
  const candidates = view.tiedCategories.includes("DATE")
    ? tiedOptions(view, "DATE")
    : view.dates.filter((option) => option.id === view.winners.DATE);
  const past = candidates.filter(
    (option) => "startsAt" in option && option.startsAt.getTime() <= now.getTime(),
  );
  if (past.length === 0) return null;
  return past.length === candidates.length ? PAST_DATE_HINT : PAST_TIED_DATE_HINT;
}

function TieCard({
  clubId,
  view,
  canManage,
  now,
}: {
  clubId: string;
  view: PollView;
  canManage: boolean;
  now: Date;
}) {
  const tied = view.tiedCategories;
  const decided = (["DATE", "PLACE"] as const).filter((category) => !tied.includes(category));
  const creator = { name: getDisplayName(view.createdBy), isMember: view.createdBy.isMember };

  const groups: TieGroup[] = tied.map((category) => ({
    category,
    legend: tieChoiceLegend(category),
    options: tiedOptions(view, category).map((option) => {
      const over = "startsAt" in option && option.startsAt.getTime() <= now.getTime();
      return {
        id: option.id,
        label: optionLabel(option),
        meta: `${optionCountLabel(category, option.count)}${over ? " · Overstået" : ""}`,
      };
    }),
  }));

  return (
    <section
      aria-labelledby="poll-tie-heading"
      className="grid grid-cols-1 gap-4 rounded-2xl border-2 border-amber bg-amber-tint/60 px-5 py-5 sm:px-6"
    >
      <div className="grid grid-cols-1 gap-1.5">
        <h2 id="poll-tie-heading" className="text-[1.5rem] leading-tight font-bold text-ink">
          {tieHeadline(tied)}
        </h2>
        {view.ballotCount === 0 ? (
          <p className="text-[1.05rem] font-semibold text-amber-ink">{NO_VOTES_NOTE}</p>
        ) : null}
      </div>

      {decided.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1 text-[1.05rem] text-ink">
          {decided.map((category) => {
            const winner = optionsOf(view, category).find(
              (option) => option.id === view.winners[category],
            );
            if (!winner) return null;
            const label =
              "startsAt" in winner ? pollDateLongLabel(winner.startsAt) : optionLabel(winner);
            return (
              <li key={category} className="break-words hyphens-auto">
                {decidedCategoryLabel({
                  category,
                  label,
                  count: view.shape[category] === "fixed" ? null : winner.count,
                })}
              </li>
            );
          })}
        </ul>
      ) : null}

      {canManage ? (
        <TieResolver
          clubId={clubId}
          pollId={view.id}
          groups={groups}
          hint={pastDateHint(view, now)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {groups.map((group) => (
            <p
              key={group.category}
              className="text-[1.05rem] font-semibold break-words hyphens-auto text-ink tabular-nums"
            >
              <span className="sr-only">
                {group.category === "DATE"
                  ? "Datoerne, der står lige: "
                  : "Stederne, der står lige: "}
              </span>
              {tiedOptionsLabel(
                tiedOptions(view, group.category).map((option) => ({
                  label: optionLabel(option),
                  count: option.count,
                })),
              )}
            </p>
          ))}
          <p className="text-[1.05rem] text-ink">{tieWaitingNote(creator)}</p>
        </div>
      )}
    </section>
  );
}
