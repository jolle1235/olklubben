/**
 * The frame colour under an installed iPhone's status bar, for shells whose
 * frame band scrolls away: its text is always light (SPEC §13.6).
 */
export function StatusBarBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] surface-frame"
    />
  );
}
