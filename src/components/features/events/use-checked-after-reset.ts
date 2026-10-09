"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Keeps a group of CONTROLLED radios or checkboxes (one `name`) ticked as
 * React state says after a server answer (F-053).
 *
 * After a form action React 19 calls form.reset(), at the end of the commit
 * that delivers the action's new state. A controlled radio or checkbox then
 * falls back to how it was first rendered (React never updates its
 * defaultChecked), while the state is unchanged, so the form would show –
 * and submit – something else than the state. This layout effect runs right
 * after that reset (same commit, before paint) and puts the ticks back.
 *
 * It runs only when `resetSignal` (the action state) has changed, never on
 * mount: there the DOM may hold a choice made before hydration, which the
 * form adopts instead (TG-037).
 */
export function useCheckedAfterReset(
  containerRef: RefObject<HTMLElement | null>,
  name: string,
  checkedValues: readonly string[],
  resetSignal: unknown,
): void {
  const key = [...checkedValues].sort().join("\n");
  const seen = useRef(resetSignal);

  useLayoutEffect(() => {
    if (seen.current === resetSignal) return;
    seen.current = resetSignal;
    const checked = new Set(key.split("\n"));
    containerRef.current
      ?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)
      .forEach((input) => {
        input.checked = checked.has(input.value);
      });
  }, [containerRef, name, key, resetSignal]);
}
