import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, pickByName } from "@/components/ui/initials";

// Initial colours: the avatar-1 … avatar-5 component tokens (src/styles/tokens/themes.ts),
// with avatar-foreground initials (≥ 4,5:1 in both themes, contrast.test.ts).
const FALLBACK_BACKGROUNDS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
] as const;

const SIZES = {
  sm: "size-8 text-label-sm",
  md: "size-10 text-label-lg",
  lg: "size-16 text-title-sm",
  xl: "size-24 text-headline-sm",
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
 * On dark surfaces, put it inside an element with the `surface-frame` or `surface-feature` utility so the
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
      className={cn(SIZES[size], porthole && "porthole", className)}
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
