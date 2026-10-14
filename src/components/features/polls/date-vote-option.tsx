import type { PreviewOption, PreviewVoter } from "./ballot-preview";
import { VoteOptionRow, type OptionMarker } from "./vote-option-row";
import type { VoteOptionModel } from "./vote-form-model";

export type DateVoteOptionProps = {
  /** Unique on the page. */
  id: string;
  option: VoteOptionModel;
  row: PreviewOption;
  viewer: PreviewVoter | null;
  marker?: OptionMarker;
  /** The checkbox (name="dateOptionIds"); omitted in the results. */
  input?: { checked: boolean; onChange: (checked: boolean) => void; describedBy?: string } | null;
};

/**
 * A date to vote on (SPEC §9.7.3, approval voting D-013): "Lørdag 14/11 ·
 * 18:30", read as "lørdag 14. november kl. 18:30", with a native checkbox
 * `dateOptionIds` – tick every date you can.
 */
export function DateVoteOption({ id, option, row, viewer, marker, input }: DateVoteOptionProps) {
  return (
    <VoteOptionRow
      id={id}
      kind="date"
      label={option.label}
      srLabel={option.srLabel}
      row={row}
      viewer={viewer}
      marker={marker}
      input={
        input
          ? {
              type: "checkbox",
              name: "dateOptionIds",
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
