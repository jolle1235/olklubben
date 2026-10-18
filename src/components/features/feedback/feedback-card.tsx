import Link from "next/link";

import { formatRelativePast } from "@/lib/format/date";
import { feedbackHref } from "@/lib/routes";
import { FEEDBACK_TYPE_ICONS, FEEDBACK_TYPE_LABELS } from "@/server/domain/feedback/status";
import type { FeedbackListItem } from "@/server/feedback/queries";

import { voteNoun } from "./feedback-labels";
import { FeedbackStatusBadge } from "./feedback-status-badge";

export type FeedbackCardProps = {
  item: FeedbackListItem;
  /** The request's time, for "for 2 dage siden". */
  now: Date;
};

/**
 * One report in the feedback list (SPEC §9.9 "Oversigt"):
 *
 *   🐞 Kalenderen viser forkert dato på mobil              👍 4
 *      [Ny] Kaptajnen · for 2 dage siden            (du har stemt)
 *
 * The whole card is one link to the report (like PlaceCard); the type icon is
 * decorative and named for screen readers. User text wraps (F-028/F-047).
 */
export function FeedbackCard({ item, now }: FeedbackCardProps) {
  return (
    <Link
      href={feedbackHref(item.id)}
      className="group/feedback flex gap-3 rounded-xl border border-border bg-paper px-4 py-3.5 transition-[border-color,box-shadow] hover:border-input hover:shadow-[0_10px_24px_-20px_rgb(65_68_55/0.7)] sm:gap-4 sm:px-5"
    >
      <span
        aria-hidden
        className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-cream-deep text-xl leading-none"
      >
        {FEEDBACK_TYPE_ICONS[item.type]}
      </span>
      <span className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        <span className="font-heading text-lg leading-snug font-semibold break-words hyphens-auto text-olive group-hover/feedback:underline group-hover/feedback:decoration-amber group-hover/feedback:decoration-2 group-hover/feedback:underline-offset-4">
          <span className="sr-only">{FEEDBACK_TYPE_LABELS[item.type]}: </span>
          {item.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem] text-muted-foreground">
          <FeedbackStatusBadge status={item.status} />
          <span className="min-w-0 break-words hyphens-auto">
            {item.authorName} · {formatRelativePast(item.createdAt, now)}
          </span>
        </span>
      </span>
      <span className="grid shrink-0 content-start justify-items-end gap-0.5 text-right">
        <span className="font-heading text-lg leading-snug font-semibold whitespace-nowrap text-ink">
          <span aria-hidden>👍 </span>
          {item.voteCount}
          <span className="sr-only"> {voteNoun(item.voteCount)}</span>
        </span>
        {item.viewerHasVoted ? (
          <span className="text-sm whitespace-nowrap text-muted-foreground">(du har stemt)</span>
        ) : null}
      </span>
    </Link>
  );
}
