"use client";

import type { RefObject } from "react";

import type { FieldErrors } from "@/lib/action-result";
import type { PollEditFormValues } from "@/server/actions/polls";
import type { DateKey } from "@/server/domain/events/time";
import type { PlaceOption } from "@/server/places/queries";
import type { PollView } from "@/server/polls/queries";

import { toPlaceChoices } from "../events/event-form-state";

import { pollEditDefaults, pollPlanStatus } from "./poll-form-state";
import { PollPlanFields } from "./poll-plan-fields";
import { usePollForm } from "./use-poll-form";

export type PollEditPlanProps = {
  clubId: string;
  view: PollView;
  /** listPlaceOptions(clubId): the club's active places (the poll's own are among them, E5). */
  places: PlaceOption[];
  today: DateKey;
  /** useActionForm's form ref, revalidate, echo, field errors and state. */
  formRef: RefObject<HTMLFormElement | null>;
  revalidate: (formData?: FormData) => void;
  echo: Partial<PollEditFormValues>;
  errors: FieldErrors;
  resetSignal: unknown;
};

/**
 * "Rediger" while nobody has voted (D-153): the create form's Hvornår? and
 * Hvor? prefilled with the poll's own options – its dates (Copenhagen days),
 * their shared start time, its places ticked and "＋ Nyt sted" – and the
 * stored deadline, which does NOT follow the dates here. The hidden
 * editOptions field makes pollEditSchema validate the plan exactly as on
 * create; updatePoll refuses it (options-locked) if a ballot arrived first.
 */
export function PollEditPlan({
  clubId,
  view,
  places,
  today,
  formRef,
  revalidate,
  echo,
  errors,
  resetSignal,
}: PollEditPlanProps) {
  const choices = toPlaceChoices(places);
  const form = usePollForm({
    formRef,
    revalidate,
    places: choices,
    defaults: {
      title: view.title,
      ...pollEditDefaults({
        dates: view.dates.map((option) => option.startsAt),
        deadline: view.deadline,
      }),
    },
    today,
    echo,
    editing: { placeIds: view.places.map((option) => option.place.id) },
  });
  const { summary } = pollPlanStatus(form);

  return (
    <>
      <input type="hidden" name="editOptions" value="1" />
      <PollPlanFields
        clubId={clubId}
        form={form}
        places={choices}
        today={today}
        hints={{
          dates:
            "Ingen har stemt endnu, så du kan stadig rette datoer og steder. Når den første stemme er afgivet, ligger de fast.",
          deadline: "Skal ligge før den første dato. Afstemningen lukker også, når alle har stemt.",
        }}
        errors={errors}
        newPlaceDefaults={{
          name: echo.newPlaceName ?? "",
          address: echo.newPlaceAddress ?? "",
          mine: echo.newPlaceMine === "on",
        }}
        resetSignal={resetSignal}
      />
      {summary ? (
        <p aria-live="polite" className="font-semibold break-words text-ink">
          {summary}
        </p>
      ) : null}
    </>
  );
}
