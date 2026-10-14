import { cn } from "@/lib/utils";

export type VoteBarProps = {
  /** 0–1: the option's count against the category's top count. */
  share: number;
  /** The option leads, won or is in the viewer's ballot: a stronger fill. */
  emphasis?: "leader" | "winner" | "tied" | null;
  className?: string;
};

/**
 * The bar under a poll option (SPEC §9.7.3). Purely visual (aria-hidden): the
 * count and the voters are in the row's text. Moves smoothly with the
 * optimistic preview, never with reduced motion.
 */
export function VoteBar({ share, emphasis = null, className }: VoteBarProps) {
  const width = `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`;
  return (
    <div
      aria-hidden
      className={cn("h-2 w-full overflow-hidden rounded-full bg-cream-deep", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
          emphasis === "leader" || emphasis === "winner"
            ? "bg-amber"
            : emphasis === "tied"
              ? "bg-harbor"
              : "bg-olive",
        )}
        style={{ width }}
      />
    </div>
  );
}
