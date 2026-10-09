"use client";

import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { leaveClubAction } from "@/server/actions/members";
import { MEMBERSHIP_MESSAGES } from "@/server/domain/clubs/membership-rules";

export type LeaveClubSectionProps = {
  clubId: string;
  clubName: string;
  /** leaveBlock(user, roster): why the user cannot leave, or null (§7.4, E2, E3). */
  block: "LAST_ADMIN" | "ONLY_MEMBER" | null;
};

/**
 * "Forlad klubben" in the club page's Farezone (SPEC §7.4, D-102).
 *
 *   * May leave: a destructive confirmation, then home with a toast (D-104).
 *   * Last admin (E2): no button; the reason and the shortcut "Gør et medlem
 *     til admin" down to the member list, where the '⋯' menu does it.
 *   * Only member (E3): the reason; the club can be deleted instead (the
 *     "Slet klubben" row next to this one).
 *
 * The server decides again under the club lock.
 */
export function LeaveClubSection({ clubId, clubName, block }: LeaveClubSectionProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <h3 className="font-heading text-lg leading-tight font-semibold text-ink">
          Forlad klubben
        </h3>
        <p className="mt-1 text-[0.95rem] text-pretty text-muted-foreground">
          {block === "LAST_ADMIN" ? (
            <>
              {MEMBERSHIP_MESSAGES.LAST_ADMIN_LEAVE}{" "}
              <a
                href="#medlemmer"
                className="font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
              >
                Gør et medlem til admin
              </a>
            </>
          ) : block === "ONLY_MEMBER" ? (
            MEMBERSHIP_MESSAGES.ONLY_MEMBER
          ) : (
            "Du mister adgangen til klubben. Dine øl, ratings og events bliver i klubben."
          )}
        </p>
      </div>
      {block === null ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="w-full sm:w-auto">
              <LogOutIcon aria-hidden />
              Forlad klubben
            </Button>
          }
          title={`Forlad ${clubName}?`}
          description="Du mister adgangen, men dine øl, ratings og events bliver i klubben. Du kan joine igen med invitationslinket."
          confirmLabel="Forlad klubben"
          pendingLabel="Forlader …"
          destructive
          onConfirm={() => leaveClubAction(clubId)}
        />
      ) : null}
    </div>
  );
}
