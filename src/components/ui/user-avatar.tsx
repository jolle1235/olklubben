import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, pickByName } from "@/components/ui/initials";

// Initial colors. Cream initials on each: olive 8,77 · harbor 6,83 · rust 6,73 ·
// brown 6,56 · slate 5,12 (all ≥ 4,5:1).
const FALLBACK_BACKGROUNDS = ["bg-olive", "bg-harbor", "bg-rust", "bg-brown", "bg-slate"] as const;

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

export type UserAvatarSize = keyof typeof SIZES;

export type UserAvatarProps = {
  name: string;
  image?: string | null;
  size?: UserAvatarSize;
  /** Brass "porthole" ring (SPEC §13.1). Default on. */
  porthole?: boolean;
  /**
   * Set when the name is already shown next to the avatar, so screen readers
   * do not read it twice. Otherwise the avatar is announced as the name.
   */
  decorative?: boolean;
  className?: string;
};

/**
 * Round avatar with a porthole ring and an initials fallback.
 * The ring is drawn outside the box (box-shadow), so leave ~5 px of room around it.
 * On dark surfaces, put it inside an element with the `on-olive` or `on-harbor` utility so the
 * gap in the ring matches the background.
 */
export function UserAvatar({
  name,
  image,
  size = "md",
  porthole = true,
  decorative = false,
  className,
}: UserAvatarProps) {
  return (
    <Avatar
      className={cn(SIZES[size], "after:hidden", porthole && "porthole", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
    >
      {image ? <AvatarImage src={image} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback
        aria-hidden
        className={cn("text-[1em]", pickByName(name, FALLBACK_BACKGROUNDS))}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
