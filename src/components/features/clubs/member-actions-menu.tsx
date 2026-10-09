"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  EllipsisIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserMinusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { removeMemberAction, setMemberRoleAction } from "@/server/actions/members";
import { MEMBERSHIP_MESSAGES, type MemberMenu } from "@/server/domain/clubs/membership-rules";

import { demoteCopy, promoteCopy, removeCopy, type MemberActionCopy } from "./club-labels";
import { MemberResetLinkDialog } from "./member-reset-link-dialog";

type DialogKind = "promote" | "demote" | "remove" | "reset";

export type MemberActionsMenuProps = {
  clubId: string;
  clubName: string;
  userId: string;
  /** getDisplayName(member): used in the labels, dialogs and toasts. */
  name: string;
  /** memberMenu(viewer, member, roster): what the admin may do (D-102). */
  menu: MemberMenu;
};

/**
 * The '⋯' menu an admin gets per member (SPEC §9.8, D-102): "Gør til admin",
 * "Fjern admin-rollen" (shown disabled with the reason for the last admin),
 * "Lav nulstillingslink" and "Fjern fra klubben". The server decides again
 * under the club lock; the menu is only what memberMenu() predicts.
 *
 * The dialogs are rendered OUTSIDE the menu (modal={false}, controlled
 * dialogs): a modal menu and a modal dialog would fight over focus and
 * pointer events. A chosen item opens its dialog once the menu has closed
 * (its close-focus would otherwise pull focus out of the dialog). A dialog
 * without its own trigger cannot return focus by itself (Radix returns it to
 * the trigger it knows), so focus goes back to '⋯' here when it closes.
 */
export function MemberActionsMenu({
  clubId,
  clubName,
  userId,
  name,
  menu,
}: MemberActionsMenuProps) {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const chosen = useRef<DialogKind | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const showDemote = menu.canDemote || menu.demoteBlockedReason !== null;

  // After the commit that closes a dialog, its focus trap is gone: back to '⋯'.
  const hadDialog = useRef(false);
  useEffect(() => {
    if (dialog !== null) {
      hadDialog.current = true;
    } else if (hadDialog.current) {
      hadDialog.current = false;
      trigger.current?.focus();
    }
  }, [dialog]);

  function choose(kind: DialogKind) {
    chosen.current = kind;
  }

  function openChosenDialog(event: Event) {
    const kind = chosen.current;
    if (kind === null) return;
    chosen.current = null;
    event.preventDefault();
    setDialog(kind);
  }

  function dialogProps(kind: Exclude<DialogKind, "reset">, copy: MemberActionCopy) {
    return {
      open: dialog === kind,
      onOpenChange: (open: boolean) => setDialog(open ? kind : null),
      title: copy.title,
      description: copy.description,
      confirmLabel: copy.confirmLabel,
      pendingLabel: "Gemmer …",
      onSuccess: () => toast.success(copy.done),
    };
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            aria-label={`Handlinger for ${name}`}
            className="shrink-0"
          >
            <EllipsisIcon aria-hidden className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-auto max-w-[min(20rem,calc(100vw-2rem))]"
          onCloseAutoFocus={openChosenDialog}
        >
          {menu.canPromote ? (
            <DropdownMenuItem onSelect={() => choose("promote")}>
              <ShieldCheckIcon aria-hidden />
              Gør til admin
            </DropdownMenuItem>
          ) : null}
          {showDemote ? (
            <>
              <DropdownMenuItem
                disabled={!menu.canDemote}
                aria-describedby={menu.canDemote ? undefined : reasonId}
                onSelect={() => choose("demote")}
              >
                <ShieldOffIcon aria-hidden />
                {menu.isSelf ? "Fjern min admin-rolle" : "Fjern admin-rollen"}
              </DropdownMenuItem>
              {menu.canDemote ? null : (
                <p id={reasonId} className="max-w-72 px-3 pb-2 text-sm text-muted-foreground">
                  {MEMBERSHIP_MESSAGES.LAST_ADMIN}
                </p>
              )}
            </>
          ) : null}
          {menu.canCreateResetLink ? (
            <DropdownMenuItem onSelect={() => choose("reset")}>
              <KeyRoundIcon aria-hidden />
              Lav nulstillingslink
            </DropdownMenuItem>
          ) : null}
          {menu.canRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => choose("remove")}>
                <UserMinusIcon aria-hidden />
                Fjern fra klubben
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {menu.canPromote ? (
        <ConfirmDialog
          {...dialogProps("promote", promoteCopy(name))}
          onConfirm={() => setMemberRoleAction(clubId, userId, "ADMIN")}
        />
      ) : null}
      {menu.canDemote ? (
        <ConfirmDialog
          {...dialogProps("demote", demoteCopy(name, menu.isSelf))}
          onConfirm={() => setMemberRoleAction(clubId, userId, "MEMBER")}
        />
      ) : null}
      {menu.canRemove ? (
        <ConfirmDialog
          {...dialogProps("remove", removeCopy(name, clubName))}
          destructive
          pendingLabel="Fjerner …"
          onConfirm={() => removeMemberAction(clubId, userId)}
        />
      ) : null}
      {menu.canCreateResetLink ? (
        <MemberResetLinkDialog
          clubId={clubId}
          userId={userId}
          name={name}
          open={dialog === "reset"}
          onOpenChange={(open) => setDialog(open ? "reset" : null)}
        />
      ) : null}
    </>
  );
}
