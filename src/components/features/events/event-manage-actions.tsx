import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";

import { DeleteEventButton } from "./delete-event-button";

export type EventManageActionsProps = {
  clubId: string;
  eventId: string;
  title: string;
  editHref: string;
  /** Rendered only when allowed (canEditEvent / canDeleteEvent). The server checks again. */
  canEdit: boolean;
  canDelete: boolean;
  /** "Rediger" is the page's primary action (before the start, SPEC §13.4.5). */
  emphasizeEdit: boolean;
};

/** "Rediger" and "Slet event" for the creator, the hosts and admins (D-098). */
export function EventManageActions({
  clubId,
  eventId,
  title,
  editHref,
  canEdit,
  canDelete,
  emphasizeEdit,
}: EventManageActionsProps) {
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {canEdit ? (
        <Button asChild variant={emphasizeEdit ? "default" : "outline"}>
          <Link href={editHref}>
            <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
            Rediger
          </Link>
        </Button>
      ) : null}
      {canDelete ? <DeleteEventButton clubId={clubId} eventId={eventId} title={title} /> : null}
    </div>
  );
}
