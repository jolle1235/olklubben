import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { BackLink } from "@/components/features/back-link";
import { BeerPhoto } from "@/components/features/beers/beer-photo";
import { BeerRating } from "@/components/features/beers/beer-rating";
import { DeleteBeerButton } from "@/components/features/beers/delete-beer-button";
import { RatingSummary } from "@/components/features/beers/rating-summary";
import { RatingsList } from "@/components/features/beers/ratings-list";
import { TastedAt } from "@/components/features/beers/tasted-at";
import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { PageHeader } from "@/components/ui/page-header";
import { formatCompactDate, toDateKey } from "@/lib/format/date";
import { getDisplayName } from "@/lib/format/display-name";
import { beerImageHref, editBeerHref, eventHref, isFromEventParam } from "@/lib/routes";
import { requireBeer, requireBeerPage } from "@/server/beers/access";
import type { BeerDetail } from "@/server/beers/queries";
import { formatAbv } from "@/server/domain/beers/abv";
import { canDeleteBeer, canEditBeer } from "@/server/domain/beers/permissions";

export async function generateMetadata({
  params,
}: PageProps<"/c/[clubId]/beers/[beerId]">): Promise<Metadata> {
  const { clubId, beerId } = await params;
  // Cached with the guard layout's call; never writes.
  const { beer } = await requireBeer(clubId, beerId);
  return { title: beer.name };
}

/**
 * Øl-detail (SPEC §9.5): the club's rating, your own (tap to rate, §10.5),
 * which event it was tasted at, and everyone's ratings. Last, "Tilføjet af"
 * with edit and delete for the creator or an admin (§5.1, D-063, D-179).
 *
 * Opened from its event's list (?from=event, eventBeerHref) the page is
 * focused on rating: "← <event>" above the name, "Din rating" right under
 * it, then the club's rating and a smaller photo. The back link goes to the
 * beer's own event; without one the parameter is ignored.
 *
 * The guard layout has already given a real 404 for a beer that is not in
 * this club (E22); requireBeerPage() returns the beer with every rating and
 * remembers the active club.
 */
export default async function BeerPage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/beers/[beerId]">) {
  const { clubId, beerId } = await params;
  const { user, membership, club, beer } = await requireBeerPage(clubId, beerId);
  const focusEvent = isFromEventParam((await searchParams).from) ? beer.event : null;

  const canEdit = canEditBeer(membership, beer, user.id);
  const canDelete = canDeleteBeer(membership, beer, user.id);
  const imageUrl = beerImageHref(club.id, beer.id, beer.imageVersion);

  return (
    <>
      {focusEvent ? (
        <BackLink href={eventHref(club.id, focusEvent.id)}>{focusEvent.title}</BackLink>
      ) : null}
      <PageHeader title={beer.name} description={formatAbv(beer.abv)} />

      <RatingsAndPhoto
        clubId={club.id}
        beer={beer}
        imageUrl={imageUrl}
        focused={focusEvent !== null}
      />

      <div className="mt-8 grid gap-8 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-10">
        <TastedAt clubId={club.id} event={beer.event} />

        <section aria-labelledby="ratings-heading" className="grid grid-cols-1 content-start gap-3">
          <h2 id="ratings-heading" className="text-title-md text-primary-ink">
            Ratings
            {beer.ratingCount > 0 ? (
              <span className="ml-2 font-sans text-body-lg font-normal text-muted-foreground">
                ({beer.ratingCount})
              </span>
            ) : null}
          </h2>
          <RatingsList ratings={beer.ratings} currentUserId={user.id} />
        </section>
      </div>

      <section
        aria-label="Om øllen"
        className="mt-10 grid grid-cols-1 gap-3 border-t border-border pt-6"
      >
        <p className="text-body-sm text-muted-foreground">
          Tilføjet af {getDisplayName(beer.createdBy)} ·{" "}
          <time dateTime={toDateKey(beer.createdAt)}>{formatCompactDate(beer.createdAt)}</time>
        </p>
        {canEdit || canDelete ? (
          <div className="flex flex-wrap gap-3">
            {canEdit ? (
              <Button asChild variant="outline">
                <Link href={editBeerHref(club.id, beer.id)}>
                  <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
                  Rediger
                </Link>
              </Button>
            ) : null}
            {canDelete ? (
              <DeleteBeerButton
                clubId={club.id}
                beerId={beer.id}
                beerName={beer.name}
                ratingCount={beer.ratingCount}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

type RatingsAndPhotoProps = {
  clubId: string;
  beer: Pick<BeerDetail, "id" | "name" | "averageStars" | "ratingCount" | "myRating">;
  imageUrl: string | null;
  /** Opened from the event: "Din rating" first, then the club's, then a smaller photo. */
  focused: boolean;
};

/** The photo, "Klubbens rating" and "Din rating", in the order the page is opened for. */
function RatingsAndPhoto({ clubId, beer, imageUrl, focused }: RatingsAndPhotoProps) {
  const clubRating = (
    <RatingSummary averageStars={beer.averageStars} ratingCount={beer.ratingCount} />
  );
  const myRating = (
    <div className="rounded-2xl border border-border bg-card px-4 py-5 sm:px-5">
      <BeerRating clubId={clubId} beerId={beer.id} myRating={beer.myRating} />
    </div>
  );
  const photo = (className: string) =>
    imageUrl ? (
      <BeerPhoto
        src={imageUrl}
        alt={`Billede af ${beer.name}`}
        className={`w-fit max-w-full rounded-2xl bg-card ${className}`}
      />
    ) : null;

  if (focused) {
    return (
      <div className="grid gap-4">
        {myRating}
        {clubRating}
        {photo("max-h-48")}
      </div>
    );
  }
  return (
    <>
      {photo("mb-6 max-h-80 md:max-h-96")}
      <div className="grid gap-4 md:grid-cols-2">
        {clubRating}
        {myRating}
      </div>
    </>
  );
}
