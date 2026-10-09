"use client";

import { useLayoutEffect, useRef } from "react";

import { ChoiceFieldset } from "@/components/features/forms/form-fields";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { HostSuggestion } from "@/server/domain/events/hosts";

import {
  canUseOwners,
  checkedHostIds,
  hostsHint,
  toggleHost,
  type HostChoice,
  type HostsState,
} from "./event-form-state";

export type HostsPickerProps = {
  /** The club's members by display name, then hosts who have left (edit only). */
  choices: readonly HostChoice[];
  currentUserId: string;
  state: HostsState;
  onStateChange: (state: HostsState) => void;
  /** What the chosen place suggests (its owners, else the fallback); null without a place. */
  suggestion: HostSuggestion | null;
  /** The suggestion's fallback when the place has no owners: the user, or (edit) the event's creator. */
  fallback: { isSelf: boolean; name: string };
  errors?: string[];
  /** Changes with every server answer: React resets the form then (F-053). */
  resetSignal: unknown;
};

/**
 * "Værter" in the event form (SPEC §9.2, D-098): one native checkbox chip per
 * member (avatar, display name, "(dig)"). While untouched, the chips follow
 * the chosen place (its owners, else the user); once the member ticks
 * something, the choice is theirs, and "Brug stedets ejere" goes back.
 * Nothing ticked = the server's default. On edit, hosts who have left show as
 * ticked "(tidligere medlem)" chips and can be unticked.
 *
 * Without JavaScript exactly what is shown is submitted (TG-037).
 */
export function HostsPicker({
  choices,
  currentUserId,
  state,
  onStateChange,
  suggestion,
  fallback,
  errors,
  resetSignal,
}: HostsPickerProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const checked = new Set(checkedHostIds(state, suggestion));
  const checkedKey = [...checked].sort().join(",");
  const hint = hostsHint({
    state,
    suggestion,
    fallbackIsSelf: fallback.isSelf,
    fallbackName: fallback.name,
  });

  // React resets the form after a server answer, and a controlled checkbox
  // falls back to how it was first rendered (F-053). Put the ticks back.
  useLayoutEffect(() => {
    const ids = new Set(checkedKey.split(","));
    listRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="hostIds"]')
      .forEach((box) => {
        box.checked = ids.has(box.value);
      });
  }, [resetSignal, checkedKey]);

  return (
    <ChoiceFieldset legend="Værter" errors={errors}>
      {(control) => (
        <>
          <ul ref={listRef} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {choices.map((choice) => {
              const suffix =
                choice.id === currentUserId ? " (dig)" : choice.former ? " (tidligere medlem)" : "";
              return (
                <li key={choice.id} className="min-w-0">
                  <label className="flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border-2 border-border bg-paper px-3 py-1.5 text-ink transition-colors hover:border-olive/50 has-checked:border-olive has-checked:bg-olive-tint has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
                    <input
                      type="checkbox"
                      name="hostIds"
                      value={choice.id}
                      checked={checked.has(choice.id)}
                      onChange={(event) =>
                        onStateChange(
                          toggleHost(state, suggestion, choice.id, event.currentTarget.checked),
                        )
                      }
                      {...control}
                      className="size-5 shrink-0 cursor-pointer accent-primary focus-visible:outline-none"
                    />
                    <UserAvatar
                      name={choice.displayName}
                      image={choice.image}
                      size="sm"
                      decorative
                      className="m-1"
                    />
                    <span className="min-w-0 flex-1 leading-snug font-semibold break-words hyphens-auto">
                      {choice.displayName}
                      {suffix ? (
                        <span className="font-normal text-muted-foreground">{suffix}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p aria-live="polite" className="text-[0.95rem] text-muted-foreground">
              {hint}
            </p>
            {canUseOwners(state, suggestion) ? (
              <Button
                type="button"
                variant="link"
                className="min-h-11 px-0"
                onClick={() => onStateChange({ touched: false, manual: [] })}
              >
                Brug stedets ejere
              </Button>
            ) : null}
          </div>
        </>
      )}
    </ChoiceFieldset>
  );
}
