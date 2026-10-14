import type { PreviewOption, PreviewVoter } from "./ballot-preview";
import { VoteOptionRow, type OptionMarker } from "./vote-option-row";
import type { VoteOptionModel } from "./vote-form-model";

export type PlaceVoteOptionProps = {
  /** Unique on the page. */
  id: string;
  option: VoteOptionModel;
  row: PreviewOption;
  viewer: PreviewVoter | null;
  marker?: OptionMarker;
  /** The radio (name="placeOptionId"); omitted in the results. */
  input?: { checked: boolean; onChange: (checked: boolean) => void; describedBy?: string } | null;
};

/**
 * A place to vote on (SPEC §9.7.3, one vote per ballot D-013): the place's
 * name (+ "(arkiveret)") as the radio's name, and "Søndergade 12 · Mads
 * bliver vært" as its description – the owners host if it wins (§9.7.7).
 */
export function PlaceVoteOption({ id, option, row, viewer, marker, input }: PlaceVoteOptionProps) {
  return (
    <VoteOptionRow
      id={id}
      kind="place"
      label={option.label}
      meta={option.meta}
      row={row}
      viewer={viewer}
      marker={marker}
      input={
        input
          ? {
              type: "radio",
              name: "placeOptionId",
              value: option.id,
              checked: input.checked,
              onChange: input.onChange,
              describedBy: input.describedBy,
            }
          : null
      }
    />
  );
}
