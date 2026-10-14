import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { getDisplayName } from "@/lib/format/display-name";
import { editPollHref } from "@/lib/routes";
import type { PollView } from "@/server/polls/queries";

import { CancelPollButton } from "./cancel-poll-button";
import { ClosePollButton } from "./close-poll-button";
import { managersNote } from "./decision-labels";

export type PollManageActionsProps = {
  clubId: string;
  view: PollView;
  /** canManagePoll(membership, view, user.id): the creator while a member, or an admin. */
  canManage: boolean;
  now: Date;
};

/**
 * The bottom of the poll page (SPEC §9.7.4, D-133). For the creator (while a
 * member) and the admins: [Rediger] and [Afslut afstemning nu] while OPEN,
 * [Annullér afstemning] while OPEN or AWAITING_DECISION (both behind a
 * ConfirmDialog). Everyone else is told who can (E11). Nothing once the poll
 * is CLOSED or CANCELLED. The buttons are only UX: every action checks again.
 *
 * "Afslut nu" stays while OPEN, also when the deadline has just passed and
 * the lazy close is pending: the data layer then closes it as DEADLINE.
 */
export function PollManageActions({ clubId, view, canManage }: PollManageActionsProps) {
  const open = view.status === "OPEN";
  const active = open || view.status === "AWAITING_DECISION";
  if (!active) return null;

  if (!canManage) {
    return (
      <p className="text-center text-[0.95rem] break-words text-muted-foreground">
        {managersNote({ name: getDisplayName(view.createdBy), isMember: view.createdBy.isMember })}
      </p>
    );
  }

  return (
    <section
      aria-label="Styr afstemningen"
      className="flex flex-wrap items-center justify-center gap-3"
    >
      {open ? (
        <Button asChild variant="outline">
          <Link href={editPollHref(clubId, view.id)}>
            <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
            Rediger
          </Link>
        </Button>
      ) : null}
      {open ? (
        <ClosePollButton
          clubId={clubId}
          pollId={view.id}
          votedCount={view.votedMemberIds.length}
          memberCount={view.members.length}
        />
      ) : null}
      <CancelPollButton clubId={clubId} pollId={view.id} title={view.title} />
    </section>
  );
}
