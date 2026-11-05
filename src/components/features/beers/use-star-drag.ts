import { useRef } from "react";

import { ratingAtX } from "./rating-input";

const DRAG_THRESHOLD_PX = 8;

type Press = { pointerId: number; startX: number; startY: number; dragging: boolean };

type StarDragOptions = {
  /** null shows the saved value again. */
  onPreview: (value: number | null) => void;
  /** A drag ended over this value. */
  onRelease: (value: number) => void;
};

/**
 * Dragging across the stars, like rating in the App Store (SPEC §9.5, D-169).
 * Spread the result on the stars' group; its children must be the stars, left
 * to right, and the group needs touch-action: pan-y so a vertical move still
 * scrolls the page.
 *
 * A drag's release can also click the star under it, so the hook swallows that
 * one click. Any key press clears the flag, since Space on a radio clicks too.
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
      // The browser took over to scroll vertically.
      press.current = null;
      onPreview(null);
    },

    onPointerLeave() {
      // A drag has captured the pointer; any other press ends here, since its
      // release outside the stars never reaches onPointerUp.
      if (press.current?.dragging) return;
      press.current = null;
      onPreview(null);
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
