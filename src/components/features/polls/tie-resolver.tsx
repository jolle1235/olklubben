"use client";

import { useMemo } from "react";

import { ChoiceFieldset } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { resolvePollTieAction, type TieFormState } from "@/server/actions/poll-lifecycle";
import type { PollCategory } from "@/server/domain/polls/options";

import { tieChoiceFormSchema } from "./decision-labels";

/** One tied option as a radio card. */
export type TieOption = {
  id: string;
  /** The accessible name: "Lørdag 14/11 · 18:30" or the place's name. */
  label: string;
  /** "4 stemmer" · "5 kan · Overstået", read as the radio's description. */
  meta: string;
};

/** The radio group of one tied category. */
export type TieGroup = {
  category: PollCategory;
  legend: string;
  options: TieOption[];
};

export type TieResolverProps = {
  clubId: string;
  pollId: string;
  /** The tied categories, DATE first. */
  groups: TieGroup[];
  /** E33: a tied or decided date is already over. */
  hint?: string | null;
};

const FIELD: Record<PollCategory, "dateOptionId" | "placeOptionId"> = {
  DATE: "dateOptionId",
  PLACE: "placeOptionId",
};

/**
 * "Vælg vinder" after a tie (SPEC §9.7.6, D-008), for the creator and the
 * admins: one radio group per tied category ("Hvilket sted bliver det?") and
 * [Vælg vinder og opret event]. A real <form> with native radios, so it works
 * before hydration and without JavaScript; with JavaScript the browser checks
 * that every group has a choice (the server checks it again, under the lock,
 * against the tied options). Success opens the poll with "poll-decided".
 */
export function TieResolver({ clubId, pollId, groups, hint }: TieResolverProps) {
  const tiedKey = groups.map((group) => group.category).join(",");
  const schema = useMemo(
    () => tieChoiceFormSchema(tiedKey.split(",") as PollCategory[]),
    [tiedKey],
  );
  const { formProps, fieldErrors, formError, values } = useActionForm<TieFormState>(
    resolvePollTieAction,
    { schema },
  );

  return (
    <form {...formProps} className="grid grid-cols-1 gap-5">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="pollId" value={pollId} />

      {formError ? <FormError>{formError.message}</FormError> : null}

      {groups.map((group) => {
        const field = FIELD[group.category];
        return (
          <ChoiceFieldset key={group.category} legend={group.legend} errors={fieldErrors[field]}>
            {(control) => (
              <div className="grid grid-cols-1 gap-2">
                {group.options.map((option) => (
                  <TieOptionCard
                    key={option.id}
                    name={field}
                    option={option}
                    defaultChecked={values[field] === option.id}
                    describedBy={control["aria-describedby"]}
                  />
                ))}
              </div>
            )}
          </ChoiceFieldset>
        );
      })}

      {hint ? (
        <p className="rounded-lg bg-paper/70 px-3.5 py-2.5 text-[0.95rem] text-ink">{hint}</p>
      ) : null}

      <SubmitButton size="lg" className="w-full sm:w-fit" pendingLabel="Opretter eventet …">
        Vælg vinder og opret event
      </SubmitButton>
    </form>
  );
}

/**
 * A native radio (visually hidden, on top of the card) with the card as its
 * label, like PlaceChoiceCard but uncontrolled, so the choice survives a
 * server round trip through `defaultChecked` and needs no JavaScript.
 */
function TieOptionCard({
  name,
  option,
  defaultChecked,
  describedBy,
}: {
  name: string;
  option: TieOption;
  defaultChecked: boolean;
  describedBy: string | undefined;
}) {
  const id = `tie-${option.id}`;
  const metaId = `${id}-meta`;
  return (
    <div className="relative grid grid-cols-1">
      <input
        type="radio"
        id={id}
        name={name}
        value={option.id}
        defaultChecked={defaultChecked}
        aria-describedby={[describedBy, metaId].filter(Boolean).join(" ")}
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
      />
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-14 items-center gap-3 rounded-xl border-2 border-border bg-paper px-3.5 py-3 text-ink transition-colors peer-hover:border-olive/50 peer-hover:bg-cream-deep/40",
          "before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-slate before:bg-paper before:content-['']",
          "peer-checked:border-olive peer-checked:bg-olive-tint peer-checked:before:border-[6px] peer-checked:before:border-olive",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
        )}
      >
        <span className="min-w-0 flex-1 font-semibold break-words hyphens-auto">
          {option.label}
        </span>
        <span
          id={metaId}
          aria-hidden
          className="shrink-0 text-[0.95rem] whitespace-nowrap text-slate tabular-nums"
        >
          {option.meta}
        </span>
      </label>
    </div>
  );
}
