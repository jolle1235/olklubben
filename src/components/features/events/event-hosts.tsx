import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDanishList } from "@/lib/format/list";
import { cn } from "@/lib/utils";

/** A host as the event page shows them (display name already resolved). */
export type EventHostView = { id: string; displayName: string; image: string | null };

/** How many avatars show before "+N" (the names are all in the text). */
const MAX_AVATARS = 4;

export type EventHostsProps = {
  /** Sorted by display name (getEvent). */
  hosts: readonly EventHostView[];
  className?: string;
};

/**
 * "Vært: Mads" / "Værter: Mads og Anders" with their avatars (SPEC §9.2,
 * D-098). The avatars are decorative: the sentence names everyone. Nothing
 * when the event has no hosts (they left before it started, §7.4).
 */
export function EventHosts({ hosts, className }: EventHostsProps) {
  if (hosts.length === 0) return null;
  const shown = hosts.slice(0, MAX_AVATARS);
  const hidden = hosts.length - shown.length;

  return (
    <p
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[1.05rem] text-ink",
        className,
      )}
    >
      <span aria-hidden className="flex items-center gap-1.5">
        {shown.map((host) => (
          <UserAvatar
            key={host.id}
            name={host.displayName}
            image={host.image}
            size="sm"
            decorative
            className="m-1"
          />
        ))}
        {hidden > 0 ? (
          <span className="ml-1 text-[0.95rem] font-semibold text-slate">+{hidden}</span>
        ) : null}
      </span>
      <span className="min-w-0 break-words hyphens-auto">
        {hosts.length === 1 ? "Vært" : "Værter"}:{" "}
        <span className="font-semibold">
          {formatDanishList(hosts.map((host) => host.displayName))}
        </span>
      </span>
    </p>
  );
}
