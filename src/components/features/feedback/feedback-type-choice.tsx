"use client";

import { ChoiceFieldset } from "@/components/features/forms/form-fields";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_TYPE_ICONS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  type FeedbackType,
} from "@/server/domain/feedback/status";

/**
 * The class on the "Fejl" radio. The form reveals its "Side" field with
 * `hidden group-has-[.feedback-type-bug:checked]/feedback:grid`, so it works
 * before hydration (like "＋ Nyt sted", D-111).
 */
export const FEEDBACK_TYPE_BUG_CLASS = "feedback-type-bug";

export type FeedbackTypeChoiceProps = {
  /** The checked type at first render and after a server answer (the echo). */
  defaultType: FeedbackType;
  onChange: (type: FeedbackType) => void;
  errors?: readonly string[];
};

/**
 * "Hvad drejer det sig om?" ( 🐞 Fejl ) ( 💡 Idé / ønske ) on "Ny rapport"
 * (SPEC §9.9). Native radios, UNCONTROLLED: the choice survives React 19's
 * form.reset() after a server answer through `defaultChecked` (the echo,
 * D-113, like TieResolver) and works before hydration. `onChange` only tells
 * the form which description placeholder to show.
 */
export function FeedbackTypeChoice({ defaultType, onChange, errors }: FeedbackTypeChoiceProps) {
  return (
    <ChoiceFieldset legend="Hvad drejer det sig om?" errors={errors}>
      {(control) => (
        <div className="grid grid-cols-2 gap-2.5">
          {FEEDBACK_TYPES.map((type) => {
            const id = `feedback-type-${type.toLowerCase()}`;
            return (
              <div key={type} className="relative grid grid-cols-1">
                {/* Invisible but on top of the card: taps and tests hit the radio itself. */}
                <input
                  type="radio"
                  id={id}
                  name="type"
                  value={type}
                  defaultChecked={defaultType === type}
                  onChange={(event) => {
                    if (event.currentTarget.checked) onChange(type);
                  }}
                  aria-describedby={control["aria-describedby"]}
                  className={cn(
                    "peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-xl opacity-0",
                    type === "BUG" && FEEDBACK_TYPE_BUG_CLASS,
                  )}
                />
                <label
                  htmlFor={id}
                  className={cn(
                    "flex min-h-14 items-center gap-2.5 rounded-xl border-2 border-border bg-paper px-3 py-3 font-semibold text-ink transition-colors peer-hover:border-olive/50 peer-hover:bg-cream-deep/40 sm:px-3.5",
                    "before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-slate before:bg-paper before:content-['']",
                    "peer-checked:border-olive peer-checked:bg-olive-tint peer-checked:before:border-[6px] peer-checked:before:border-olive",
                    "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                  )}
                >
                  <span className="min-w-0 break-words">
                    <span aria-hidden>{FEEDBACK_TYPE_ICONS[type]} </span>
                    {FEEDBACK_TYPE_LABELS[type]}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </ChoiceFieldset>
  );
}
