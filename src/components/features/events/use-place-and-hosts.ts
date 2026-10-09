"use client";

import { useEffect, useEffectEvent, useMemo, useState, type RefObject } from "react";

import {
  checkedHostIds,
  hostSuggestion,
  initialHostsState,
  initialPlaceId,
  ownersOfChoice,
  type HostChoice,
  type HostsState,
  type PlaceChoice,
} from "./event-form-state";

export type UsePlaceAndHostsInput = {
  formRef: RefObject<HTMLFormElement | null>;
  /** useActionForm's revalidate: a no-op until the browser has shown errors. */
  revalidate: (formData?: FormData) => void;
  places: readonly PlaceChoice[];
  hostChoices: readonly HostChoice[];
  currentUserId: string;
  hostFallback: { userId: string; name: string };
  prefillPlaceId?: string | null;
  /** Edit: the event's place and hosts. Create: null. */
  defaults: { placeId: string | null; hostIds: string[] | null };
  /** What a failed submit sent (useActionForm's values). */
  echo: {
    placeId?: string;
    newPlaceName?: string;
    newPlaceMine?: string;
    hostIds?: readonly string[];
  };
};

/**
 * The event form's place and host state (SPEC §9.2, D-098, D-099): the chosen
 * place, what is typed for "＋ Nyt sted", and the hosts – untouched they
 * follow the place's owners (suggestHosts), touched they are the member's own.
 * Starts from the echo of a failed submit, else the event (edit), else the
 * selector's default rules.
 */
export function usePlaceAndHosts({
  formRef,
  revalidate,
  places,
  hostChoices,
  currentUserId,
  hostFallback,
  prefillPlaceId,
  defaults,
  echo,
}: UsePlaceAndHostsInput) {
  const memberIds = useMemo(
    () => new Set(hostChoices.filter((choice) => !choice.former).map((choice) => choice.id)),
    [hostChoices],
  );
  const [placeId, setPlaceId] = useState(() =>
    initialPlaceId({
      places,
      echoed: echo.placeId,
      currentPlaceId: defaults.placeId,
      prefillPlaceId,
    }),
  );
  const [newPlaceName, setNewPlaceName] = useState(echo.newPlaceName ?? "");
  const [newPlaceMine, setNewPlaceMine] = useState(echo.newPlaceMine === "on");
  const suggestion = hostSuggestion({
    ownerIds: ownersOfChoice({ placeId, places, newPlaceMine, userId: currentUserId }),
    memberIds,
    fallbackUserId: hostFallback.userId,
  });
  const [hosts, setHosts] = useState<HostsState>(() =>
    initialHostsState({ echoed: echo.hostIds, existing: defaults.hostIds, suggestion }),
  );

  // Before hydration the radios and checkboxes are plain HTML. Adopt what was
  // chosen then, or React's next render would quietly undo it (TG-037).
  // React keeps the server-rendered state in defaultChecked.
  const adoptPreHydrationChoices = useEffectEvent(() => {
    const form = formRef.current;
    if (!form) return;
    const inputs = (selector: string) => [...form.querySelectorAll<HTMLInputElement>(selector)];
    const changed = (name: string) =>
      inputs(`input[name="${name}"]`).some((input) => input.checked !== input.defaultChecked);
    if (changed("placeId")) {
      const picked = inputs('input[name="placeId"]:checked')[0];
      if (picked) setPlaceId(picked.value);
    }
    if (changed("hostIds")) {
      setHosts({
        touched: true,
        manual: inputs('input[name="hostIds"]:checked').map((input) => input.value),
      });
    }
    const name = form.elements.namedItem("newPlaceName");
    if (name instanceof HTMLInputElement) setNewPlaceName(name.value);
    const mine = form.elements.namedItem("newPlaceMine");
    if (mine instanceof HTMLInputElement) setNewPlaceMine(mine.checked);
  });
  useEffect(() => {
    // The DOM is the external source here; read it once, right after hydration.
    const frame = requestAnimationFrame(adoptPreHydrationChoices);
    return () => cancelAnimationFrame(frame);
  }, []);

  /** Re-validates with a change React has not rendered yet (no DOM event carried it). */
  function revalidateWith(update: (formData: FormData) => void) {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    update(formData);
    revalidate(formData);
  }

  return {
    placeId,
    selectPlace(id: string) {
      setPlaceId(id);
      revalidateWith((formData) => formData.set("placeId", id));
    },
    newPlaceName,
    setNewPlaceName,
    setNewPlaceMine,
    suggestion,
    hosts,
    changeHosts(next: HostsState) {
      setHosts(next);
      revalidateWith((formData) => {
        formData.delete("hostIds");
        for (const id of checkedHostIds(next, suggestion)) formData.append("hostIds", id);
      });
    },
  };
}
