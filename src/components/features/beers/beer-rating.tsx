"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import { DEFAULT_ERROR_MESSAGES } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { rateBeerAction, removeRatingAction } from "@/server/actions/ratings";
import { formatStars, MAX_STARS, ratingToStars, starFills } from "@/server/domain/ratings/ratings";

import { ratingAfterKey, ratingAtX } from "./rating-input";
import { RatingStar } from "./rating-star";

/** Arrow keys step through values; save once the member pauses (one request, one "Gemt ✓"). */
const KEYBOARD_SAVE_DELAY_MS = 600;
const STATUS_VISIBLE_MS = 2500;
/** How far a finger moves sideways before a press becomes a drag across the stars. */
const DRAG_THRESHOLD_PX = 8;

/** A press on the stars that may turn into a drag (pointer id and where it started). */
type Drag = { pointerId: number; startX: number; startY: number; dragging: boolean };

export type BeerRatingProps = {
  clubId: string;
  beerId: string;
  /** The member's own rating (stored 2..10), or null. */
  myRating: number | null;
  className?: string;
};

/**
 * "Din rating" (SPEC §9.5 <BeerRating />, §13.4.6, §15.2): five large stars.
 * The left half of a star gives a half star, the right half a whole star.
 * Saves at once (optimistic, then a small "Gemt ✓"); a failure rolls back
 * and shows an error toast. "Fjern min rating" is a discreet link below.
 *
 * A finger (or mouse) can also drag across the stars, like rating in the App
 * Store: the stars follow it 1:1 and the value is saved on release (§13.4).
 * The stars preview from the moment they are pressed. Sideways only
 * (touch-action: pan-y), so scrolling the page past them still works.
 *
 * Accessible as a radio group of nine native radios ("4,5 ud af 5"):
 * Left/Down −½, Right/Up +½, Home/End. Keyboard changes are saved after a
 * short pause, or when focus leaves the stars.
 *
 * The Server Actions revalidate the club, so the same response re-renders the
 * page with the new average, count and list of ratings.
 */
export function BeerRating({ clubId, beerId, myRating, className }: BeerRatingProps) {
  const [rating, setOptimisticRating] = useOptimistic(myRating);
  const [, startTransition] = useTransition();
  // A keyboard value that is waiting for its save.
  const [draft, setDraft] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [status, setStatus] = useState<"saved" | "removed" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingKeyboardValue = useRef<number | null>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const stars = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // A drag that ended: swallow the click it may still produce on a star.
  const swallowClick = useRef(false);
  const headingId = useId();
  const hintId = useId();
  const groupName = `rating-${beerId}`;

  const current = draft ?? rating;
  const shown = hover ?? current;
  const fills = starFills(shown === null ? null : ratingToStars(shown));

  // Leaving the page with a keyboard value still waiting: save it anyway.
  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      clearTimeout(statusTimer.current);
      const value = pendingKeyboardValue.current;
      if (value !== null) void rateBeerAction({ clubId, beerId, value }).catch(() => {});
    };
  }, [clubId, beerId]);

  function showStatus(next: "saved" | "removed") {
    setStatus(next);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), STATUS_VISIBLE_MS);
  }

  function save(value: number | null) {
    clearTimeout(saveTimer.current);
    clearTimeout(statusTimer.current);
    pendingKeyboardValue.current = null;
    setHover(null);
    // Outside the transition, so "" commits before the request: each save then
    // writes fresh text into the live region (a second "Gemt ✓" within
    // STATUS_VISIBLE_MS is announced too), and no stale "Gemt ✓" shows while a
    // save is in flight or after it fails.
    setStatus(null);
    startTransition(async () => {
      setOptimisticRating(value);
      setDraft(null);
      try {
        const result =
          value === null
            ? await removeRatingAction({ clubId, beerId })
            : await rateBeerAction({ clubId, beerId, value });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        showStatus(value === null ? "removed" : "saved");
      } catch (error) {
        // A stale session redirects to /login; a deleted beer gives a 404.
        unstable_rethrow(error);
        console.error(error);
        toast.error(DEFAULT_ERROR_MESSAGES.UNEXPECTED);
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    swallowClick.current = false;
    const next = ratingAfterKey(current, event.key);
    if (next === undefined) return;
    event.preventDefault();
    setHover(null);
    inputs.current.get(next)?.focus();
    if (next === current) return;
    setDraft(next);
    pendingKeyboardValue.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(next), KEYBOARD_SAVE_DELAY_MS);
  }

  function ratingAt(x: number) {
    const group = stars.current;
    return group
      ? ratingAtX(
          x,
          Array.from(group.children, (star) => star.getBoundingClientRect()),
        )
      : null;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    swallowClick.current = false;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    // Respond on press, not on release: the star under the finger lights up.
    setHover(ratingAt(event.clientX));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const press = drag.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (!press.dragging) {
      const dx = Math.abs(event.clientX - press.startX);
      const dy = Math.abs(event.clientY - press.startY);
      if (dx < DRAG_THRESHOLD_PX || dx < dy) return;
      press.dragging = true;
      // Keep following the finger past the ends of the stars.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setHover(ratingAt(event.clientX));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const press = drag.current;
    drag.current = null;
    if (!press?.dragging || press.pointerId !== event.pointerId) return;
    swallowClick.current = true;
    const value = ratingAt(event.clientX);
    if (value === null || value === current) setHover(null);
    else save(value);
  }

  function handlePointerCancel() {
    // The browser took over (a vertical scroll): back to the saved value.
    drag.current = null;
    setHover(null);
  }

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    const value = pendingKeyboardValue.current;
    if (value !== null) save(value);
  }

  return (
    <section aria-labelledby={headingId} className={cn("grid gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-heading text-title-sm text-primary-ink">
          Din rating
        </h2>
        <p aria-live="polite" className="text-body-sm font-semibold text-primary-ink">
          {status === "saved" ? "Gemt ✓" : status === "removed" ? "Rating fjernet" : ""}
        </p>
      </div>

      <div
        ref={stars}
        role="radiogroup"
        aria-labelledby={headingId}
        aria-describedby={hintId}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
        onPointerLeave={() => {
          if (!drag.current) setHover(null);
        }}
        className="flex w-fit touch-pan-y gap-(--star-gap) rounded-xl p-1.5 pb-3 select-none [--star-gap:0.375rem] [--star-reach:calc(var(--star-gap)/2)] [--star-size:3.25rem] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring sm:[--star-size:3.5rem]"
      >
        {Array.from({ length: MAX_STARS }, (_, index) => (
          <RatingStar
            key={index}
            index={index}
            fill={fills[index] ?? "empty"}
            preview={hover !== null && hover !== current}
            name={groupName}
            checked={current}
            onSelect={save}
            onPreview={setHover}
            registerInput={(value, element) => {
              if (element) inputs.current.set(value, element);
              else inputs.current.delete(value);
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p id={hintId} className="text-body-sm text-muted-foreground">
          {current === null ? (
            "Tryk på en stjerne, eller træk hen over stjernerne. Venstre halvdel giver en halv."
          ) : (
            <>
              <span className="font-semibold text-foreground">{formatStars(current)}</span> ud af{" "}
              {MAX_STARS} · tryk for at ændre
            </>
          )}
        </p>
        {rating !== null ? (
          <button
            type="button"
            onClick={() => save(null)}
            className="inline-flex items-center text-body-sm text-muted-foreground underline decoration-1 underline-offset-4 pressable-dim hover:text-foreground pointer-coarse:min-h-11"
          >
            Fjern min rating
          </button>
        ) : null}
      </div>
    </section>
  );
}
