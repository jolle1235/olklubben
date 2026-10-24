import { cn } from "@/lib/utils";

/**
 * A beer's photo (D-158): the member-only image route (beerImageHref) or a
 * blob: preview. A plain <img>: the route already serves a sized WebP with a
 * year-long private cache, so next/image has nothing to add.
 */
export function BeerPhoto({
  src,
  alt,
  className,
  lazy = false,
}: {
  src: string;
  /** "" when the photo is decorative (the card's name says it all). */
  alt: string;
  className?: string;
  lazy?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img
      src={src}
      alt={alt}
      loading={lazy ? "lazy" : undefined}
      className={cn("rounded-xl border border-border bg-cream-deep object-contain", className)}
    />
  );
}
