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
 * "Klubbens rating" (SPEC §9.5 Øl-detail): ★★★★½ 4,7 · 12 ratings, on a harbor
 * panel with amber stars (3,18:1, ≥ 3:1 for graphics). The average is computed on read and shown
 * with one decimal (§3.4); "Ingen ratings endnu" before the first rating.
 */
export function RatingSummary({ averageStars, ratingCount, className }: RatingSummaryProps) {
  return (
    <section
      aria-labelledby="club-rating-heading"
      className={cn("grid content-between gap-3 rounded-2xl on-harbor px-5 py-5", className)}
    >
      <h2
        id="club-rating-heading"
        className="font-sans text-sm font-semibold tracking-[0.14em] text-on-dark-muted uppercase"
      >
        Klubbens rating
      </h2>
      {averageStars === null ? (
        <div className="grid gap-2">
          <span aria-hidden>
            <RatingStars stars={null} className="text-[1.75rem] text-on-dark-muted" />
          </span>
          <p className="text-[1.05rem] text-cream">Ingen ratings endnu. Bliv den første!</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Read once, by the stars' label ("4,7 ud af 5"). */}
          <p aria-hidden className="font-display text-5xl leading-none font-bold text-cream">
            {formatRating(averageStars)}
          </p>
          <div className="grid gap-1">
            <RatingStars stars={averageStars} className="text-[1.75rem] text-amber" />
            <p className="text-[0.95rem] text-on-dark-muted">{ratingCountLabel(ratingCount)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
