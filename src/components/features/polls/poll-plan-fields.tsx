"use client";

import Link from "next/link";

import type { FieldErrors } from "@/lib/action-result";
import { newEventHref } from "@/lib/routes";
import type { DateKey } from "@/server/domain/events/time";

import type { PlaceChoice } from "../events/event-form-state";

import { PollDateRows } from "./poll-date-rows";
import { PollDeadlineField } from "./poll-deadline-field";
import { pollPlanStatus, SHAPE_HINT_TEXT } from "./poll-form-state";
import { PollPlacePicker } from "./poll-place-picker";
import type { PollFormController } from "./use-poll-form";

export type PollPlanFieldsProps = {
  clubId: string;
  /** usePollForm: the rows, the start time, the ticked places and the deadline. */
  form: PollFormController;
  /** The club's active places, last used first (listPlaceOptions). */
  places: readonly PlaceChoice[];
  /** Today in Copenhagen: the date pickers' minimum. */
  today: DateKey;
  hints: { dates: string; deadline: string };
  errors: FieldErrors;
  /** "＋ Nyt sted"'s fields as last submitted (the echo). */
  newPlaceDefaults: { name: string; address: string; mine: boolean };
  /** useActionForm's state: the place ticks are put back after React's form reset (D-113). */
  resetSignal: unknown;
};

/**
 * The plan in a poll form (SPEC §9.7.1, D-134, D-135): Hvornår? (date rows
 * and one start time) → Hvor? (place cards and "＋ Nyt sted") → the live hint
 * (a fixed category, or nothing to vote on with a link to "Opret event") →
 * Afstemningsfrist. Shared by "Planlæg ølsmagning" and by "Rediger" while
 * nobody has voted (D-153); the form owns the state (usePollForm) and the
 * Server Action decides.
 */
export function PollPlanFields({
  clubId,
  form,
  places,
  today,
  hints,
  errors,
  newPlaceDefaults,
  resetSignal,
}: PollPlanFieldsProps) {
  const { hint, firstDate, onlyPlace } = pollPlanStatus(form);

  return (
    <>
      <PollDateRows
        rows={form.rows}
        onAdd={form.addRow}
        onRemove={form.removeRow}
        onChange={form.changeRow}
        startTime={form.startTime}
        onStartTimeChange={form.changeStartTime}
        today={today}
        hint={hints.dates}
        errors={{ dates: errors.dates, startTime: errors.startTime }}
      />

      <PollPlacePicker
        places={places}
        selection={form.selection}
        onTogglePlace={form.togglePlace}
        onToggleNewPlace={form.toggleNewPlace}
        onChooseExisting={form.chooseExisting}
        newPlaceDefaults={newPlaceDefaults}
        newPlaceName={form.newPlaceName}
        onNewPlaceNameChange={form.setNewPlaceName}
        errors={{
          placeIds: errors.placeIds,
          newPlaceName: errors.newPlaceName,
          newPlaceAddress: errors.newPlaceAddress,
        }}
        resetSignal={resetSignal}
      />

      <div aria-live="polite" className="empty:hidden">
        {hint === "nothing-to-vote" ? (
          <p className="grid grid-cols-1 gap-1 rounded-xl border-2 border-amber bg-amber-tint px-4 py-3 text-ink">
            <span className="font-semibold">{SHAPE_HINT_TEXT[hint]}</span>
            <span className="text-[0.95rem]">
              Tilføj en dato eller et sted mere – eller{" "}
              <Link
                href={newEventHref(clubId, { date: firstDate, placeId: onlyPlace })}
                className="font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber"
              >
                opret et event i stedet
              </Link>
              .
            </span>
          </p>
        ) : hint ? (
          <p className="rounded-xl bg-harbor-tint px-4 py-3 text-[0.95rem] text-harbor">
            {SHAPE_HINT_TEXT[hint]}
          </p>
        ) : null}
      </div>

      <PollDeadlineField
        value={form.deadline}
        onChange={form.changeDeadline}
        today={today}
        hint={hints.deadline}
        errors={{ deadlineDate: errors.deadlineDate, deadlineTime: errors.deadlineTime }}
      />
    </>
  );
}
