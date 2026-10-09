"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { HouseIcon, UserMinusIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/action-result";
import { compareByDisplayName, getDisplayName } from "@/lib/format/display-name";
import { setOwnPlaceOwnershipAction } from "@/server/actions/places";
import type { PersonRef } from "@/server/users/select";

import { RemovePlaceOwnerButton } from "./remove-place-owner-button";

export type PlaceOwnersProps = {
  clubId: string;
  placeId: string;
  placeName: string;
  /** Sorted by display name. */
  owners: PersonRef[];
  /** The viewer, added to the list at once when they claim the place. */
  viewer: PersonRef;
  /** Admins remove OTHER owners (canRemovePlaceOwner). */
  canRemoveOthers: boolean;
};

/** The list as it looks with the viewer's (optimistic) ownership. */
function ownersShown(owners: PersonRef[], viewer: PersonRef, owned: boolean): PersonRef[] {
  const others = owners.filter((owner) => owner.id !== viewer.id);
  return owned ? [...others, viewer].sort(compareByDisplayName) : others;
}

/**
 * "Ejere" on a place (SPEC §9.4): who owns it (avatars + display names), the
 * one toggle "Det er mit sted" / "Fjern mig som ejer" (no confirmation,
 * §15.1) and, for admins, an X per other owner.
 *
 * The toggle is optimistic (§13.4.6): the button and the list change at once,
 * a failure rolls back with an error toast. It sends the desired state, so
 * a double tap is harmless. The label says what the button does, so it is
 * not an aria-pressed toggle (its name would change with its state); a
 * polite status line says what happened.
 */
export function PlaceOwners({
  clubId,
  placeId,
  placeName,
  owners,
  viewer,
  canRemoveOthers,
}: PlaceOwnersProps) {
  const isOwner = owners.some((owner) => owner.id === viewer.id);
  const [owned, setOptimisticOwned] = useOptimistic(isOwner);
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shown = ownersShown(owners, viewer, owned);

  function toggle() {
    const next = !owned;
    setStatus("");
    startTransition(async () => {
      setOptimisticOwned(next);
      try {
        const result = await setOwnPlaceOwnershipAction(clubId, placeId, next);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        setStatus(next ? "Du er nu ejer af stedet." : "Du er ikke længere ejer af stedet.");
      } catch (error) {
        // A stale session redirects to /login; a deleted place gives a 404.
        unstable_rethrow(error);
        console.error(error);
        toast.error(DEFAULT_ERROR_MESSAGES.UNEXPECTED);
      }
    });
  }

  return (
    <section aria-labelledby="place-owners-heading" className="grid grid-cols-1 gap-3">
      <h2
        id="place-owners-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl text-olive focus:outline-none"
      >
        Ejere
      </h2>
      <p className="text-[0.95rem] text-muted-foreground">
        Ejerne bliver automatisk værter, når stedet bruges til en smagning. Allerede oprettede
        events ændres ikke.
      </p>

      {shown.length > 0 ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-paper px-4 sm:px-5">
          {shown.map((owner) => {
            const name = getDisplayName(owner);
            const isMe = owner.id === viewer.id;
            return (
              <li key={owner.id} className="flex min-h-16 items-center gap-3 py-2.5">
                <UserAvatar name={name} image={owner.image} decorative className="m-1" />
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
                  <span className="min-w-0 font-semibold break-words hyphens-auto text-ink">
                    {name}
                  </span>
                  {isMe ? <span className="text-muted-foreground">(dig)</span> : null}
                </p>
                {canRemoveOthers && !isMe ? (
                  <RemovePlaceOwnerButton
                    clubId={clubId}
                    placeId={placeId}
                    placeName={placeName}
                    ownerId={owner.id}
                    ownerName={name}
                    onRemoved={() => headingRef.current?.focus()}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-paper/60 px-4 py-4 text-muted-foreground">
          Ingen ejere. Så bliver den, der opretter smagningen, vært.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" variant={owned ? "ghost" : "outline"} onClick={toggle}>
          {owned ? <UserMinusIcon aria-hidden /> : <HouseIcon aria-hidden />}
          {owned ? "Fjern mig som ejer" : "Det er mit sted"}
        </Button>
        <p role="status" className="text-[0.95rem] font-semibold text-olive">
          {status}
        </p>
      </div>
    </section>
  );
}
