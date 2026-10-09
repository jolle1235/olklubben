import { cn } from "@/lib/utils";
import { getInitials } from "@/components/ui/initials";

const SIZES = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-14 text-xl",
} as const;

export type ClubBadgeProps = {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * The club's initials in a brass porthole, like a stamp on a beer label.
 * Decorative: the club name is always shown next to it.
 * On dark surfaces, place it inside an `on-olive` or `on-harbor` element.
 */
export function ClubBadge({ name, size = "md", className }: ClubBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center porthole rounded-full bg-olive-deep font-display font-bold text-amber",
        SIZES[size],
        // After the size (text-* carries a line height, F-016), before className so callers can override.
        "leading-none",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
