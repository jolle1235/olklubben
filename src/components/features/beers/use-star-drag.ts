import { useRef } from "react";

import { ratingAtX } from "./rating-input";

/** How far a finger moves sideways before a press becomes a drag across the stars. */
const DRAG_THRESHOLD_PX = 8;

/** A press on the stars that may turn into a drag (pointer id and where it started). */
type Press = { pointerId: number; startX: number; startY: number; dragging: boolean };

type StarDragOptions = {
  /** The value under the finger while pressing or dragging; null goes back to the saved one. */
  onPreview: (value: number | null) => void;
  /** A drag ended over this value. */
  onRelease: (value: number) => void;
};

/**
 * Dragging across the stars, like rating in the App Store (SPEC §9.5, D-169).
 * The star under the finger lights up on press, the stars follow the finger
 * 1:1 once it moves sideways, and the value is given on release. Sideways
 * only: a vertical move leaves the press to the page's scroll
 * (touch-action: pan-y), and pointer capture keeps following a finger past
 * the ends of the stars.
 *
 * Spread the result on the stars' group; its children must be the stars,
 * left to right. A drag's release can still produce a click on a star: the
 * hook swallows that one click, and any key press clears it (Space on a
 * radio clicks too).
 */
export function useStarDrag({ onPreview, onRelease }: StarDragOptions) {
  const group = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);

  function ratingAt(x: number) {
    const stars = group.current;
    if (!stars) return null;
    return ratingAtX(
      x,
      Array.from(stars.children, (star) => star.getBoundingClientRect()),
    );
  }

  return {
    ref: group,

    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      swallowClick.current = false;
      press.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      // Respond on press, not on release: the star under the finger lights up.
      onPreview(ratingAt(event.clientX));
    },

    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.dragging) {
        const dx = Math.abs(event.clientX - current.startX);
        const dy = Math.abs(event.clientY - current.startY);
        if (dx < DRAG_THRESHOLD_PX || dx < dy) return;
        current.dragging = true;
        // Keep following the finger past the ends of the stars.
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      onPreview(ratingAt(event.clientX));
    },

    onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      const current = press.current;
      press.current = null;
      if (!current?.dragging || current.pointerId !== event.pointerId) return;
      swallowClick.current = true;
      const value = ratingAt(event.clientX);
      if (value === null) onPreview(null);
      else onRelease(value);
    },

    onPointerCancel() {
      // The browser took over (a vertical scroll): back to the saved value.
      press.current = null;
      onPreview(null);
    },

    onPointerLeave() {
      if (!press.current) onPreview(null);
    },

    onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },

    onKeyDownCapture() {
      swallowClick.current = false;
    },
  };
}
