"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Runs `restore` right after a form action's answer (F-053): React 19 calls
 * form.reset() at the end of the commit that delivers the new action state,
 * which empties file inputs and puts controlled radios, checkboxes and
 * selects back to how they were first rendered. A layout effect in the same
 * commit runs after that reset and before paint.
 *
 * Only when `actionState` changed, never on mount: there the DOM may hold a
 * choice made before hydration, which the form adopts instead (TG-037).
 * `restore` should read the current choice; the latest one is always used.
 */
export function useAfterServerAnswer(actionState: unknown, restore: () => void): void {
  const seen = useRef(actionState);
  const latest = useRef(restore);
  useLayoutEffect(() => {
    latest.current = restore;
  });
  useLayoutEffect(() => {
    if (seen.current === actionState) return;
    seen.current = actionState;
    latest.current();
  }, [actionState]);
}
