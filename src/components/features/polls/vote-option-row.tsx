import { CheckIcon } from "lucide-react";

import { formatDanishList } from "@/lib/format/list";
import { cn } from "@/lib/utils";

import {
  voterNames,
  votersSentence,
  type PreviewOption,
  type PreviewVoter,
  type VoterRowKind,
} from "./ballot-preview";
import { VoteBar } from "./vote-bar";
import { VoterAvatars, voterListName } from "./voter-avatars";

/** A marker on a row: leading now, the decided winner, or tied at the top. */
export type OptionMarker = "leader" | "winner" | "tied" | null;

const MARKER_TEXT: Record<Exclude<OptionMarker, null>, string> = {
  leader: "Fører",
  winner: "🏆 Vinder",
  tied: "🤝 Står lige",
};

/** With more voters than this, the names move into "Se alle (N)". */
const INLINE_NAMES_MAX = 4;

export type VoteOptionInput = {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** Extra ids for aria-describedby (the group's error). */
  describedBy?: string;
};

export type VoteOptionRowProps = {
  /** Unique on the page (the input's id and the description ids derive from it). */
  id: string;
  kind: VoterRowKind;
  /** What the row shows, fx "Lørdag 14/11 · 18:30" or "Hos Mads". */
  label: React.ReactNode;
  /** The accessible name when it should differ from the visible label ("lørdag 14. november kl. 18:30"). */
  srLabel?: string;
  /** Second line, fx "Søndergade 12 · Mads bliver vært". */
  meta?: string | null;
  row: PreviewOption;
  /** The viewer as a voter (their avatar while ticked). */
  viewer: PreviewVoter | null;
  marker?: OptionMarker;
  /** Null: a read-only result row (no input). */
  input?: VoteOptionInput | null;
  className?: string;
};

/**
 * One option of a poll (SPEC §9.7.3): the label, the count, a bar, the
 * voters' avatars and – openly, D-014 – their names. With `input` the whole
 * top part is the label of a NATIVE checkbox or radio (works before
 * hydration; ≥ 56 px), with the count and marker hidden from its name and
 * read as its description instead ("3 kan: Mads, Anders og Bo"). The "Se alle"
 * list sits outside the label (no interactive element inside it).
 *
 * No hooks: the vote form (client) and the results (server) share it.
 */
export function VoteOptionRow({
  id,
  kind,
  label,
  srLabel,
  meta,
  row,
  viewer,
  marker = null,
  input = null,
  className,
}: VoteOptionRowProps) {
  const inputId = `${id}-input`;
  const descriptionId = `${id}-voters`;
  const metaId = `${id}-meta`;
  const sentence = votersSentence(kind, row);
  const names = voterNames(row.others, row.viewer);
  const everyone = [
    ...(viewer && row.viewer !== "none"
      ? [{ id: viewer.id, name: voterListName(viewer, row.viewer) }]
      : []),
    ...row.others.map((voter) => ({ id: voter.id, name: voterListName(voter, "other") })),
  ];
  const describedBy = [input?.describedBy, meta ? metaId : null, descriptionId]
    .filter(Boolean)
    .join(" ");

  const top = (
    <>
      {input ? (
        <input
          type={input.type}
          id={inputId}
          name={input.name}
          value={input.value}
          checked={input.checked}
          onChange={(event) => input.onChange?.(event.currentTarget.checked)}
          aria-describedby={describedBy}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-primary"
        />
      ) : null}
      <span className="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
        <span className="text-[1.05rem] leading-snug font-semibold break-words hyphens-auto text-ink">
          {srLabel ? (
            <>
              <span aria-hidden>{label}</span>
              <span className="sr-only">{srLabel}</span>
            </>
          ) : (
            label
          )}
        </span>
        {meta ? (
          <span
            id={metaId}
            aria-hidden={input ? true : undefined}
            className="text-[0.95rem] break-words hyphens-auto text-slate"
          >
            {meta}
          </span>
        ) : null}
      </span>
      <span aria-hidden={input ? true : undefined} className="flex shrink-0 items-center gap-2">
        {marker ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap",
              marker === "tied" ? "bg-harbor-tint text-harbor" : "bg-amber text-ink",
            )}
          >
            {MARKER_TEXT[marker]}
          </span>
        ) : null}
        <span className="min-w-6 text-right text-xl leading-none font-bold text-ink tabular-nums">
          {row.count}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 rounded-xl border-2 border-border bg-paper transition-colors",
        input &&
          "hover:border-olive/50 has-[input:checked]:border-olive has-[input:checked]:bg-olive-tint has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
        !input && (marker === "winner" ? "border-amber bg-amber-tint/60" : null),
        className,
      )}
    >
      {input ? (
        <label
          htmlFor={inputId}
          className="flex min-h-14 cursor-pointer items-start gap-3 px-3.5 pt-3 pb-2"
        >
          {top}
        </label>
      ) : (
        <div className="flex min-h-14 items-start gap-3 px-3.5 pt-3 pb-2">
          {row.viewer !== "none" ? (
            <CheckIcon
              role="img"
              aria-label="Din stemme"
              className="mt-1 size-5 shrink-0 text-olive"
            />
          ) : null}
          {top}
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5 px-3.5 pb-3">
        <VoteBar
          share={row.share}
          emphasis={
            marker === "leader" || marker === "winner" ? marker : marker === "tied" ? "tied" : null
          }
        />
        <p id={descriptionId} className="sr-only">
          {marker ? `${MARKER_TEXT[marker].replace(/^\S+ /, "")}. ` : ""}
          {sentence}
        </p>
        {row.count > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <VoterAvatars others={row.others} viewer={viewer} viewerMark={row.viewer} />
            {names.length <= INLINE_NAMES_MAX ? (
              <span aria-hidden className="min-w-0 text-[0.95rem] break-words text-slate">
                {formatDanishList(names)}
              </span>
            ) : (
              <details className="min-w-0 text-[0.95rem] text-slate">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber">
                  Se alle ({everyone.length})
                </summary>
                <ul className="grid grid-cols-1 gap-0.5 pb-1 break-words">
                  {everyone.map((person) => (
                    <li key={person.id}>{person.name}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
