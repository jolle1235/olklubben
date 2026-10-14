import { UserAvatar } from "@/components/ui/user-avatar";
import { getDisplayName } from "@/lib/format/display-name";
import { cn } from "@/lib/utils";
import type { PollView } from "@/server/polls/queries";

import { missingLabel, votedSummaryLabel } from "./poll-labels";

export type VotingProgressProps = { view: PollView };

/** With more members than this, the bar is one continuous fill instead of segments. */
const SEGMENTS_MAX = 24;

/**
 * Who has voted (SPEC §9.7.3, §3.4: computed, never stored): a bar with one
 * segment per current member and "6 af 8 har stemt · Mangler: Anders, Bo og
 * dig" with the missing members' avatars. "Alle har stemt 🎉" when nobody is
 * missing; "6 af 8 stemte" once voting has ended. Former members' ballots
 * stay in the results but never fill a seat here (E12).
 */
export function VotingProgress({ view }: VotingProgressProps) {
  const total = view.members.length;
  const voted = view.votedMemberIds.length;
  const open = view.status === "OPEN";
  const viewerId = view.members.find((member) => member.isViewer)?.id ?? "";
  const everyone = total > 0 && voted === total;
  const summary = open ? votedSummaryLabel(voted, total) : `${voted} af ${total} stemte`;
  const missing = open && !everyone ? missingLabel(view.missingMembers, viewerId) : "";

  return (
    <section aria-labelledby="poll-progress-heading" className="grid grid-cols-1 gap-3">
      <h2 id="poll-progress-heading" className="sr-only">
        Hvem har stemt
      </h2>
      {total > 0 ? (
        total <= SEGMENTS_MAX ? (
          <div aria-hidden className="flex h-2.5 gap-1">
            {view.members.map((member, index) => (
              <span
                key={member.id}
                className={cn(
                  "h-full flex-1 rounded-full",
                  index < voted ? "bg-olive" : "bg-cream-deep",
                )}
              />
            ))}
          </div>
        ) : (
          <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-cream-deep">
            <div
              className="h-full rounded-full bg-olive"
              style={{ width: `${Math.round((voted / total) * 100)}%` }}
            />
          </div>
        )
      ) : null}
      <p className="text-[1.05rem] break-words text-ink">
        <span className="font-semibold">{everyone && open ? "Alle har stemt 🎉" : summary}</span>
        {missing ? <span className="text-slate"> · {missing}</span> : null}
      </p>
      {missing ? (
        <div aria-hidden className="flex flex-wrap gap-2.5 p-1">
          {view.missingMembers.map((member) => (
            <UserAvatar
              key={member.id}
              name={getDisplayName(member)}
              image={member.image}
              size="sm"
              decorative
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
