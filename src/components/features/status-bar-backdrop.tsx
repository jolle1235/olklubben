/**
 * The frame colour under an installed iPhone's status bar, for shells whose
 * frame band scrolls away, when the status bar is "black-translucent" (light
 * text over the page). Dormant (0 px) under "default" (SPEC §13.6, D-188).
 */
export function StatusBarBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] surface-frame"
    />
  );
}
