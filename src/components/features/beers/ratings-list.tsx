import { RatingStars } from "@/components/features/ratings/rating-stars";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getDisplayName } from "@/lib/format/display-name";
import type { BeerRatingEntry } from "@/server/beers/queries";
import { formatStars, ratingAriaLabel, ratingToStars } from "@/server/domain/ratings/ratings";

export type RatingsListProps = {
  /** Highest first (getBeer sorts them). */
  ratings: BeerRatingEntry[];
  currentUserId: string;
};

/**
 * "Ratings" on the beer page (SPEC §9.5): every member's rating, highest
 * first – it is a small club, so seeing each other's ratings is half the fun.
 * Names go through getDisplayName (nickname in round 3, "Tidligere medlem" for
 * a deleted account). Ratings of members who left still count and show (Q6).
 */
export function RatingsList({ ratings, currentUserId }: RatingsListProps) {
  if (ratings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-paper/60 px-4 py-5 text-muted-foreground">
        Ingen har ratet den endnu.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-paper px-4 sm:px-5">
      {ratings.map((rating) => {
        const name = getDisplayName(rating.user);
        return (
          <li key={rating.user.id} className="flex min-h-15 items-center gap-3 py-2.5">
            <UserAvatar name={name} size="sm" decorative className="m-1" />
            <p className="min-w-0 flex-1 font-semibold break-words hyphens-auto text-ink">
              {name}
              {rating.user.id === currentUserId ? (
                <span className="font-normal text-muted-foreground"> (dig)</span>
              ) : null}
            </p>
            <RatingStars
              stars={ratingToStars(rating.value)}
              label={ratingAriaLabel(rating.value)}
              className="text-[1.05rem]"
            />
            <span
              aria-hidden
              className="w-7 shrink-0 text-right font-semibold text-ink tabular-nums"
            >
              {formatStars(rating.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
