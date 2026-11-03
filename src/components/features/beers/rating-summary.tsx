import { RatingStars } from "@/components/features/ratings/rating-stars";
import { cn } from "@/lib/utils";
import { formatRating, ratingCountLabel } from "@/server/domain/ratings/ratings";

export type RatingSummaryProps = {
  /** The club's average in stars (unrounded), null without ratings. */
  averageStars: number | null;
  ratingCount: number;
  className?: string;
};

/**
 * "Klubbens rating" (SPEC §9.5 Øl-detail): ★★★★½ 4,7 · 12 ratings, on a feature
 * panel with highlight stars (≥ 3:1 for graphics, contrast.test.ts). The average is computed on read and shown
 * with one decimal (§3.4); "Ingen ratings endnu" before the first rating.
 */
export function RatingSummary({ averageStars, ratingCount, className }: RatingSummaryProps) {
  return (
    <section
      aria-labelledby="club-rating-heading"
      className={cn("grid content-between gap-3 rounded-2xl surface-feature px-5 py-5", className)}
    >
      <h2
        id="club-rating-heading"
        className="font-sans text-label-lg font-semibold caps text-feature-muted-foreground"
      >
        Klubbens rating
      </h2>
      {averageStars === null ? (
        <div className="grid gap-2">
          <span aria-hidden>
            <RatingStars stars={null} className="text-title-lg text-feature-muted-foreground" />
          </span>
          <p className="text-lead text-feature-foreground">Ingen ratings endnu. Bliv den første!</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Read once, by the stars' label ("4,7 ud af 5"). */}
          <p
            aria-hidden
            className="font-display text-display-md leading-none font-bold text-feature-foreground"
          >
            {formatRating(averageStars)}
          </p>
          <div className="grid gap-1">
            <RatingStars stars={averageStars} className="text-title-lg text-highlight" />
            <p className="text-body-sm text-feature-muted-foreground">
              {ratingCountLabel(ratingCount)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
