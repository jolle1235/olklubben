import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { averageRatingAriaLabel, starFills } from "@/server/domain/ratings/ratings";

export type RatingStarsProps = {
  /** Stars 1–5 (an average such as 4.3, or ratingToStars(value)); null = no ratings. */
  stars: number | null;
  /** Screen reader text; defaults to "4,3 ud af 5" / "Ingen ratings endnu". */
  label?: string;
  className?: string;
};

/**
 * Five stars for a rating, read-only (SPEC §9.5 "★★★★½ 4,7"): rounded to the
 * nearest half star. Shared by the beer catalogue, the beer page and the
 * event page's beer list. The interactive rating (<BeerRating />, a radio
 * group) is a separate component.
 *
 * Sized by the surrounding font size (1em per star) and coloured by
 * currentColor: amber-ink by default (5.2:1 on cream); on harbor pass
 * className="text-amber". Server-safe; one role="img" with a Danish label.
 */
export function RatingStars({ stars, label, className }: RatingStarsProps) {
  const ariaLabel =
    label ?? (stars === null ? "Ingen ratings endnu" : averageRatingAriaLabel(stars));

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn("inline-flex shrink-0 items-center gap-[0.1em] text-amber-ink", className)}
    >
      {starFills(stars).map((fill, index) => (
        <span key={index} aria-hidden className="relative inline-block size-[1em]">
          <StarIcon className="absolute inset-0 size-full" strokeWidth={1.75} />
          {fill === "empty" ? null : (
            <span
              className={cn(
                "absolute inset-y-0 left-0 overflow-hidden",
                fill === "half" ? "w-1/2" : "w-full",
              )}
            >
              <StarIcon className="size-[1em] max-w-none fill-current" strokeWidth={1.75} />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
