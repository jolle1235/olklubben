import { cn } from "@/lib/utils";
import { getInitials } from "@/components/ui/initials";

const SIZES = {
  sm: "size-8 text-label-lg",
  md: "size-10 text-body-md",
  lg: "size-14 text-title-sm",
} as const;

export type ClubBadgeProps = {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * The club's initials in a brass porthole, like a stamp on a beer label.
 * Decorative: the club name is always shown next to it.
 * On dark surfaces, place it inside a `surface-frame` or `surface-feature` element.
 */
export function ClubBadge({ name, size = "md", className }: ClubBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center porthole rounded-full bg-frame-sunken font-display font-bold text-highlight",
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
