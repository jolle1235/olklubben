"use client";

import type { RefObject } from "react";

import { useAfterServerAnswer } from "@/components/features/forms/use-after-server-answer";

/**
 * Keeps a group of CONTROLLED radios or checkboxes (one `name`) ticked as
 * React state says after a server answer (F-053).
 *
 * After a form action React 19 calls form.reset(), at the end of the commit
 * that delivers the action's new state. A controlled radio or checkbox then
 * falls back to how it was first rendered (React never updates its
 * defaultChecked), while the state is unchanged, so the form would show –
 * and submit – something else than the state. This layout effect runs right
 * after that reset (same commit, before paint) and puts the ticks back
 * (useAfterServerAnswer: only when `resetSignal`, the action state, changed).
 */
export function useCheckedAfterReset(
  containerRef: RefObject<HTMLElement | null>,
  name: string,
  checkedValues: readonly string[],
  resetSignal: unknown,
): void {
  useAfterServerAnswer(resetSignal, () => {
    const checked = new Set(checkedValues);
    containerRef.current
      ?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)
      .forEach((input) => {
        input.checked = checked.has(input.value);
      });
  });
}
