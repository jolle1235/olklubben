"use client";

import { useId, useMemo, useRef } from "react";

import { useActionForm } from "@/components/features/forms/use-action-form";
import { FieldError, FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { BALLOT_ARRAY_FIELDS } from "@/lib/validation/poll";
import { castBallotAction } from "@/server/actions/polls";

import { useCheckedAfterReset } from "../events/use-checked-after-reset";

import {
  EMPTY_DRAFT,
  isDraftDirty,
  previewNoDateWorks,
  previewOptions,
  setDraftNoDateWorks,
  setDraftPlace,
  toggleDraftDate,
  topCount,
  voteFormSchema,
} from "./ballot-preview";
import { DateVoteOption } from "./date-vote-option";
import { FixedOptionRow } from "./fixed-option-row";
import { PlaceVoteOption } from "./place-vote-option";
import { useBallotDraft } from "./use-ballot-draft";
import type { VoteFormModel } from "./vote-form-model";
import { VoteOptionRow } from "./vote-option-row";

function SectionHeading({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <legend className="mb-3 flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 id={id} className="text-xl font-bold tracking-tight text-olive">
        {title}
      </h2>
      <span className="text-[0.95rem] text-slate">{note}</span>
    </legend>
  );
}

/**
 * The interactive part of PollVoteForm (SPEC §9.7.3, D-013, D-136). Native
 * checkboxes and radios, so voting works before hydration and without
 * JavaScript; with it:
 *   * ticking a date unticks «Ingen af datoerne passer mig» and the other way
 *     round (the server refuses the combination anyway);
 *   * the optimistic preview: counts, bars, "Fører" and the member's own
 *     avatar (dashed until saved) follow the ticks, and "Ikke gemt endnu"
 *     shows while the form differs from the saved ballot – which also pauses
 *     PollAutoRefresh (data-dirty);
 *   * the browser checks completeness with the server's messages.
 */
export function PollVoteFormFields({ model }: { model: VoteFormModel }) {
  const baseId = useId();
  const schema = useMemo(() => voteFormSchema(model.options), [model.options]);
  const { state, formProps, fieldErrors, formError, revalidate } = useActionForm(castBallotAction, {
    schema,
    arrayFields: BALLOT_ARRAY_FIELDS,
  });
  const saved = model.saved ?? EMPTY_DRAFT;
  const { draft, update } = useBallotDraft({
    formRef: formProps.ref,
    revalidate,
    saved,
  });
  const dirty = isDraftDirty(draft, saved);
  const datesRef = useRef<HTMLFieldSetElement>(null);
  const placesRef = useRef<HTMLFieldSetElement>(null);

  // React resets the form after a server answer; put the controlled ticks back (F-053).
  useCheckedAfterReset(datesRef, "dateOptionIds", draft.dateOptionIds, state);
  useCheckedAfterReset(datesRef, "noDateWorks", draft.noDateWorks ? ["on"] : [], state);
  useCheckedAfterReset(
    placesRef,
    "placeOptionId",
    draft.placeOptionId ? [draft.placeOptionId] : [],
    state,
  );

  const viewerId = model.viewer.id;
  const savedDates = new Set(saved.dateOptionIds);
  const dateRows = previewOptions({
    options: model.dates,
    viewerId,
    ticked: new Set(draft.dateOptionIds),
    saved: savedDates,
    mode: model.shape.DATE,
  });
  const noneRow = previewNoDateWorks({
    voters: model.noDateWorksVoters,
    viewerId,
    ticked: draft.noDateWorks,
    saved: saved.noDateWorks,
    dateTop: topCount(dateRows),
  });
  const placeRows = previewOptions({
    options: model.places,
    viewerId,
    ticked: new Set(draft.placeOptionId ? [draft.placeOptionId] : []),
    saved: new Set(saved.placeOptionId ? [saved.placeOptionId] : []),
    mode: model.shape.PLACE,
  });

  const dateErrorId = `${baseId}-dates-error`;
  const placeErrorId = `${baseId}-places-error`;
  const dateError = fieldErrors.dateOptionIds?.[0];
  const placeError = fieldErrors.placeOptionId?.[0];
  const [fixedDate] = model.dates;
  const [fixedPlace] = model.places;

  return (
    <form
      id="stem"
      {...formProps}
      data-dirty={dirty ? "true" : undefined}
      aria-label="Din stemme"
      className="grid scroll-mt-24 grid-cols-1 gap-8"
    >
      <input type="hidden" name="clubId" value={model.clubId} />
      <input type="hidden" name="pollId" value={model.pollId} />

      {formError ? <FormError>{formError.message}</FormError> : null}

      {model.shape.DATE === "vote" ? (
        <fieldset
          ref={datesRef}
          aria-describedby={dateError ? dateErrorId : undefined}
          className="grid min-w-0 grid-cols-1 gap-3"
        >
          <SectionHeading
            id={`${baseId}-dates`}
            title="Hvornår?"
            note="(sæt kryds ved alle, du kan)"
          />
          {dateError ? <FieldError id={dateErrorId}>{dateError}</FieldError> : null}
          {model.dates.map((option, index) => {
            const row = dateRows[index];
            if (!row) return null;
            return (
              <DateVoteOption
                key={option.id}
                id={`${baseId}-date-${option.id}`}
                option={option}
                row={row}
                viewer={model.viewer}
                marker={row.isLeader ? "leader" : null}
                input={{
                  checked: draft.dateOptionIds.includes(option.id),
                  onChange: (checked) => update(toggleDraftDate(draft, option.id, checked)),
                  describedBy: dateError ? dateErrorId : undefined,
                }}
              />
            );
          })}
          <div className="mt-1 border-t-2 border-dashed border-border pt-4">
            <VoteOptionRow
              id={`${baseId}-none`}
              kind="none"
              label="Ingen af datoerne passer mig"
              row={noneRow}
              viewer={model.viewer}
              input={{
                type: "checkbox",
                name: "noDateWorks",
                value: "on",
                checked: draft.noDateWorks,
                onChange: (checked) => update(setDraftNoDateWorks(draft, checked)),
                describedBy: dateError ? dateErrorId : undefined,
              }}
            />
          </div>
        </fieldset>
      ) : fixedDate ? (
        <FixedOptionRow category="DATE" label={fixedDate.srLabel ?? fixedDate.label} />
      ) : null}

      {model.shape.PLACE === "vote" ? (
        <fieldset
          ref={placesRef}
          aria-describedby={placeError ? placeErrorId : undefined}
          className="grid min-w-0 grid-cols-1 gap-3"
        >
          <SectionHeading id={`${baseId}-places`} title="Hvor?" note="(vælg ét)" />
          {placeError ? <FieldError id={placeErrorId}>{placeError}</FieldError> : null}
          {model.places.map((option, index) => {
            const row = placeRows[index];
            if (!row) return null;
            return (
              <PlaceVoteOption
                key={option.id}
                id={`${baseId}-place-${option.id}`}
                option={option}
                row={row}
                viewer={model.viewer}
                marker={row.isLeader ? "leader" : null}
                input={{
                  checked: draft.placeOptionId === option.id,
                  onChange: (checked) => {
                    if (checked) update(setDraftPlace(draft, option.id));
                  },
                  describedBy: placeError ? placeErrorId : undefined,
                }}
              />
            );
          })}
        </fieldset>
      ) : fixedPlace ? (
        <FixedOptionRow category="PLACE" label={fixedPlace.label} meta={fixedPlace.meta} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border-2 border-dashed border-harbor/40 bg-paper px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="grid min-w-0 grid-cols-1 gap-1" aria-live="polite">
          {dirty ? (
            <p className="font-semibold text-amber-ink">Ikke gemt endnu</p>
          ) : model.saved ? (
            <p className="font-semibold text-olive">Du har stemt ✓</p>
          ) : null}
          <p className="text-[0.95rem] break-words text-slate">
            {model.saved
              ? `Du kan ændre din stemme indtil ${model.deadlineLabel}.`
              : `Du kan stemme indtil ${model.deadlineLabel} – og ændre det bagefter.`}
          </p>
        </div>
        <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Gemmer …">
          {model.saved ? "Opdatér min stemme" : "Gem min stemme"}
        </SubmitButton>
      </div>
    </form>
  );
}
