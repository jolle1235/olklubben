import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

import type { PreviewVoter, ViewerMark } from "./ballot-preview";

export type VoterAvatarsProps = {
  /** The other voters, in display-name order. */
  others: readonly PreviewVoter[];
  /** The viewer, shown first while their (saved or unsaved) tick is on this row. */
  viewer: PreviewVoter | null;
  viewerMark: ViewerMark;
  /** At most this many avatars, then "+N". */
  max?: number;
  className?: string;
};

/**
 * Who voted for an option, as small avatars (SPEC §9.7.3, D-014: votes are
 * open). Up to five, then "+2". The viewer comes last: with a dashed ring
 * while the tick is not saved yet (the optimistic preview, D-136). Decorative
 * – the row's description and "Se alle" list carry the names.
 */
export function VoterAvatars({
  others,
  viewer,
  viewerMark,
  max = 5,
  className,
}: VoterAvatarsProps) {
  const self =
    viewer && viewerMark !== "none" ? [{ voter: viewer, pending: viewerMark === "pending" }] : [];
  const people = [...others.map((voter) => ({ voter, pending: false })), ...self];
  // The viewer comes last, like "Mads, Anders og dig" – and is never hidden in "+N".
  const shown = [
    ...others.slice(0, Math.max(0, max - self.length)).map((voter) => ({ voter, pending: false })),
    ...self,
  ];
  if (people.length === 0) return null;
  const rest = people.length - shown.length;

  return (
    <div aria-hidden className={cn("flex flex-wrap items-center gap-2.5 p-1", className)}>
      {shown.map(({ voter, pending }) =>
        pending ? (
          <span
            key={voter.id}
            className="rounded-full outline-2 outline-offset-2 outline-olive outline-dashed"
          >
            <UserAvatar
              name={voter.name}
              image={voter.image}
              size="sm"
              porthole={false}
              decorative
            />
          </span>
        ) : (
          <UserAvatar
            key={voter.id}
            name={voter.name}
            image={voter.image}
            size="sm"
            decorative
            className={voter.former ? "opacity-60" : undefined}
          />
        ),
      )}
      {rest > 0 ? (
        <span className="text-[0.9rem] font-semibold text-slate tabular-nums">+{rest}</span>
      ) : null}
    </div>
  );
}

/** "Mads", "Anders (tidligere medlem)", "Jesper (dig, ikke gemt endnu)". */
export function voterListName(voter: PreviewVoter, mark: ViewerMark | "other"): string {
  if (mark === "pending") return `${voter.name} (dig, ikke gemt endnu)`;
  if (mark === "saved") return `${voter.name} (dig)`;
  return voter.former ? `${voter.name} (tidligere medlem)` : voter.name;
}
