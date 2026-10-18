"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

import type { PollFormValues } from "@/server/actions/polls";
import type { DateKey } from "@/server/domain/events/time";

import type { PlaceChoice } from "../events/event-form-state";

import type { PollFormDefaults } from "./poll-form";
import {
  addDateRow,
  changeDateRow,
  followDeadline,
  initialDateRows,
  initialDeadline,
  initialPlaceSelection,
  removeDateRow,
  togglePlace,
  type DateRow,
  type DeadlineValue,
  type PlaceSelection,
} from "./poll-form-state";

export type UsePollFormInput = {
  formRef: RefObject<HTMLFormElement | null>;
  /** useActionForm's revalidate: a no-op until the browser has shown errors. */
  revalidate: (formData?: FormData) => void;
  places: readonly PlaceChoice[];
  defaults: PollFormDefaults;
  today: DateKey;
  /** What a failed submit sent (useActionForm's values). */
  echo: Partial<PollFormValues>;
  /**
   * "Rediger" while nobody has voted (D-153): the poll's current places start
   * ticked, and the stored deadline never follows the dates. `defaults` then
   * holds the poll's own dates, start time and deadline (pollEditDefaults).
   */
  editing?: { placeIds: readonly string[] } | null;
};

/**
 * The poll form's state (SPEC §9.7.1, D-135): the date rows, the shared start
 * time, the ticked places and "＋ Nyt sted", and the deadline – which follows
 * the first date (suggestDeadline) until the member touches it (never while
 * editing). Starts from the echo of a failed submit, else the page's
 * suggestions or the poll's own options. The rules are the pure functions in
 * poll-form-state.ts.
 */
export function usePollForm({
  formRef,
  revalidate,
  places,
  defaults,
  today,
  echo,
  editing = null,
}: UsePollFormInput) {
  const echoed = echo.placeIds !== undefined || echo.dates !== undefined;
  const [rows, setRows] = useState<DateRow[]>(() =>
    initialDateRows({ echoed: echo.dates, suggested: defaults.dates, today }),
  );
  const [startTime, setStartTime] = useState(echo.startTime ?? defaults.startTime);
  const [selection, setSelection] = useState<PlaceSelection>(() =>
    initialPlaceSelection({
      placeIds: places.map((place) => place.id),
      echo: echoed ? { placeIds: echo.placeIds, newPlace: echo.newPlace ?? "" } : null,
      current: editing?.placeIds ?? null,
    }),
  );
  const [newPlaceName, setNewPlaceName] = useState(echo.newPlaceName ?? "");
  const [deadlineState, setDeadlineState] = useState(() =>
    initialDeadline({
      echoed: echoed ? { date: echo.deadlineDate, time: echo.deadlineTime } : null,
      suggested: defaults.deadline,
      pinned: editing !== null,
    }),
  );
  const keySequence = useRef(0);
  const focusKey = useRef<string | null>(null);

  /** Re-runs the suggestion after the dates or the start time changed (event handlers only). */
  function withDeadlineFollowing(nextRows: readonly DateRow[], nextStartTime: string) {
    setDeadlineState((current) => ({
      ...current,
      value: followDeadline({
        current: current.value,
        touched: current.touched,
        rows: nextRows,
        startTime: nextStartTime,
        now: new Date(),
      }),
    }));
  }

  // Changes that no DOM event carried (a new row, a followed deadline, "Vælg
  // det") re-validate once React has rendered them.
  const revalidateRendered = useEffectEvent(() => revalidate());
  useEffect(() => {
    revalidateRendered();
  }, [rows, selection, deadlineState]);

  // "+ Tilføj dato" moves focus to the new row once it exists.
  useEffect(() => {
    const key = focusKey.current;
    if (!key) return;
    focusKey.current = null;
    formRef.current?.querySelector<HTMLInputElement>(`[data-row-key="${key}"]`)?.focus();
  }, [rows, formRef]);

  // Before hydration the fields are plain HTML: adopt what was typed or ticked
  // then, or React's next render would quietly undo it (TG-037).
  const adoptPreHydrationInput = useEffectEvent(() => {
    const form = formRef.current;
    if (!form) return;
    const inputs = (name: string) => [
      ...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
    ];
    const dateInputs = inputs("dates");
    if (dateInputs.some((input) => input.value !== input.defaultValue)) {
      setRows((current) =>
        current.map((row, index) => ({ ...row, date: dateInputs[index]?.value ?? row.date })),
      );
    }
    const time = inputs("startTime")[0];
    if (time && time.value !== time.defaultValue) setStartTime(time.value);
    const boxes = [...inputs("placeIds"), ...inputs("newPlace")];
    if (boxes.some((box) => box.checked !== box.defaultChecked)) {
      setSelection({
        placeIds: inputs("placeIds")
          .filter((box) => box.checked)
          .map((box) => box.value),
        newPlace: inputs("newPlace").some((box) => box.checked),
      });
    }
    const name = inputs("newPlaceName")[0];
    if (name) setNewPlaceName(name.value);
    const [deadlineDate] = inputs("deadlineDate");
    const [deadlineTime] = inputs("deadlineTime");
    if (
      (deadlineDate && deadlineDate.value !== deadlineDate.defaultValue) ||
      (deadlineTime && deadlineTime.value !== deadlineTime.defaultValue)
    ) {
      setDeadlineState({
        value: { date: deadlineDate?.value ?? "", time: deadlineTime?.value ?? "" },
        touched: true,
      });
    }
  });
  useEffect(() => {
    const frame = requestAnimationFrame(adoptPreHydrationInput);
    return () => cancelAnimationFrame(frame);
  }, []);

  return {
    rows,
    addRow() {
      keySequence.current += 1;
      const key = `date-added-${keySequence.current}`;
      const next = addDateRow(rows, today, key);
      if (next.length === rows.length) return;
      focusKey.current = key;
      setRows(next);
      withDeadlineFollowing(next, startTime);
    },
    removeRow(key: string) {
      const next = removeDateRow(rows, key);
      setRows(next);
      withDeadlineFollowing(next, startTime);
    },
    changeRow(key: string, date: string) {
      const next = changeDateRow(rows, key, date);
      setRows(next);
      withDeadlineFollowing(next, startTime);
    },
    startTime,
    changeStartTime(value: string) {
      setStartTime(value);
      withDeadlineFollowing(rows, value);
    },
    selection,
    togglePlace(id: string) {
      setSelection((current) => ({
        ...current,
        placeIds: togglePlace(current.placeIds, id, !current.placeIds.includes(id)),
      }));
    },
    toggleNewPlace() {
      setSelection((current) => ({ ...current, newPlace: !current.newPlace }));
    },
    /** "Vælg det" (E29): tick the existing place instead of creating a new one. */
    chooseExisting(id: string) {
      setSelection((current) => ({
        placeIds: togglePlace(current.placeIds, id, true),
        newPlace: false,
      }));
    },
    newPlaceName,
    setNewPlaceName,
    deadline: deadlineState.value,
    changeDeadline(value: DeadlineValue) {
      setDeadlineState({ value, touched: true });
    },
  };
}

/** What usePollForm hands the form's fields (PollPlanFields). */
export type PollFormController = ReturnType<typeof usePollForm>;
