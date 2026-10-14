import { getDisplayName, type DisplayNameUser } from "@/lib/format/display-name";
import { formatDanishList } from "@/lib/format/list";
import type { PollOptionRef, PollShape } from "@/server/domain/polls/options";
import type { PollPerson, PollView } from "@/server/polls/queries";

import { draftFromBallot, type BallotDraft, type PreviewVoter } from "./ballot-preview";
import { pollDateLabel, pollDateLongLabel } from "./poll-labels";

/**
 * What the vote form and the results need from a PollView, flattened to
 * plain, serializable values with the texts already formatted on the server
 * (Copenhagen time, display names). The vote form is a Client Component; this
 * keeps its props small and its render free of time-zone work.
 *
 * Pure module (types only from the server).
 */

export type VoteOptionModel = {
  id: string;
  /** "Lørdag 14/11 · 18:30" / "Hos Mads (arkiveret)". */
  label: string;
  /** Dates: "lørdag 14. november kl. 18:30" (the accessible name). */
  srLabel?: string;
  /** Places: "Søndergade 12 · Mads bliver vært". */
  meta?: string | null;
  /** Who stored a tick (the viewer included when saved). */
  voters: PreviewVoter[];
};

export type VoteFormModel = {
  clubId: string;
  pollId: string;
  viewer: PreviewVoter;
  shape: PollShape;
  /** For the browser's completeness check (voteFormSchema). */
  options: PollOptionRef[];
  dates: VoteOptionModel[];
  noDateWorksVoters: PreviewVoter[];
  places: VoteOptionModel[];
  /** The stored ballot, or null before the first vote. */
  saved: BallotDraft | null;
  /** "tirsdag 10. november kl. 20:00". */
  deadlineLabel: string;
};

export function toPreviewVoter(person: PollPerson): PreviewVoter {
  return {
    id: person.id,
    name: getDisplayName(person),
    image: person.image,
    former: !person.isMember,
  };
}

/**
 * Who hosts if the place wins (§9.7.7, D-009): "Mads bliver vært" ·
 * "Mads og Anders bliver værter" · "Ingen ejere – Jesper bliver vært"
 * (the creator, while a member) · "Ingen ejere endnu".
 */
export function placeHostsLabel(
  ownerNames: readonly string[],
  creator: DisplayNameUser & { isMember: boolean },
): string {
  if (ownerNames.length === 1) return `${ownerNames[0]} bliver vært`;
  if (ownerNames.length > 1) return `${formatDanishList(ownerNames)} bliver værter`;
  return creator.isMember
    ? `Ingen ejere – ${getDisplayName(creator)} bliver vært`
    : "Ingen ejere endnu";
}

/** "Søndergade 12 · Mads bliver vært". */
export function placeOptionMeta(
  place: { address: string | null; ownerNames: readonly string[] },
  creator: DisplayNameUser & { isMember: boolean },
): string {
  return [place.address, placeHostsLabel(place.ownerNames, creator)]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/** "Hos Mads" · "Hos Mads (arkiveret)". */
export function placeOptionLabel(place: { name: string; archived: boolean }): string {
  return place.archived ? `${place.name} (arkiveret)` : place.name;
}

export function dateOptionModel(option: PollView["dates"][number]): VoteOptionModel {
  return {
    id: option.id,
    label: pollDateLabel(option.startsAt),
    srLabel: pollDateLongLabel(option.startsAt),
    voters: option.voters.map(toPreviewVoter),
  };
}

export function placeOptionModel(
  option: PollView["places"][number],
  creator: PollView["createdBy"],
): VoteOptionModel {
  return {
    id: option.id,
    label: placeOptionLabel(option.place),
    meta: placeOptionMeta(option.place, creator),
    voters: option.voters.map(toPreviewVoter),
  };
}

/** The viewer as a voter: a member (they are on the page), from the member list. */
export function viewerOf(view: PollView): PreviewVoter {
  const me = view.members.find((member) => member.isViewer);
  return me ? toPreviewVoter(me) : { id: "", name: "Dig", image: null, former: false };
}

export function voteFormModel(input: {
  clubId: string;
  view: PollView;
  deadlineLabel: string;
}): VoteFormModel {
  const { view } = input;
  return {
    clubId: input.clubId,
    pollId: view.id,
    viewer: viewerOf(view),
    shape: view.shape,
    options: [
      ...view.dates.map((option) => ({ id: option.id, category: "DATE" as const })),
      ...view.places.map((option) => ({ id: option.id, category: "PLACE" as const })),
    ],
    dates: view.dates.map(dateOptionModel),
    noDateWorksVoters: view.noDateWorksVoters.map(toPreviewVoter),
    places: view.places.map((option) => placeOptionModel(option, view.createdBy)),
    saved: view.myBallot ? draftFromBallot(view.myBallot) : null,
    deadlineLabel: input.deadlineLabel,
  };
}
