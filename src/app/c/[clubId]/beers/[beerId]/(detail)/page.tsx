import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon, PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
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
import { beerImageHref, editBeerHref, newBeerHref } from "@/lib/routes";
import { requireBeer, requireBeerPage } from "@/server/beers/access";
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
 * which event it was tasted at, and everyone's ratings. Edit and delete for
 * the creator or an admin (§5.1, D-063).
 *
 * The guard layout has already given a real 404 for a beer that is not in
 * this club (E22); requireBeerPage() returns the beer with every rating and
 * remembers the active club.
 */
export default async function BeerPage({ params }: PageProps<"/c/[clubId]/beers/[beerId]">) {
  const { clubId, beerId } = await params;
  const { user, membership, club, beer } = await requireBeerPage(clubId, beerId);

  // During a tasting the next beer usually belongs to the same event (§10.5).
  const addHref = newBeerHref(club.id, { eventId: beer.event?.id });
  const canEdit = canEditBeer(membership, beer, user.id);
  const canDelete = canDeleteBeer(membership, beer, user.id);
  const imageUrl = beerImageHref(club.id, beer.id, beer.imageVersion);

  return (
    <>
      <TopBarAction>
        <Button asChild size="icon" variant="brass">
          <Link href={addHref} aria-label="Tilføj øl">
            <PlusIcon aria-hidden />
          </Link>
        </Button>
      </TopBarAction>

      <PageHeader title={beer.name} description={formatAbv(beer.abv)} />

      {imageUrl ? (
        <BeerPhoto
          src={imageUrl}
          alt={`Billede af ${beer.name}`}
          className="mb-6 max-h-80 w-fit max-w-full rounded-2xl bg-paper md:max-h-96"
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <RatingSummary averageStars={beer.averageStars} ratingCount={beer.ratingCount} />
        <div className="rounded-2xl border border-border bg-paper px-4 py-5 sm:px-5">
          <BeerRating clubId={club.id} beerId={beer.id} myRating={beer.myRating} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-10">
        <div className="grid grid-cols-1 content-start gap-8">
          <TastedAt clubId={club.id} event={beer.event} newBeerHref={beer.event ? addHref : null} />

          <section aria-label="Om øllen" className="grid grid-cols-1 gap-3">
            <p className="text-[0.95rem] text-muted-foreground">
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
        </div>

        <section aria-labelledby="ratings-heading" className="grid grid-cols-1 content-start gap-3">
          <h2 id="ratings-heading" className="text-2xl text-olive">
            Ratings
            {beer.ratingCount > 0 ? (
              <span className="ml-2 font-sans text-lg font-normal text-muted-foreground">
                ({beer.ratingCount})
              </span>
            ) : null}
          </h2>
          <RatingsList ratings={beer.ratings} currentUserId={user.id} />
        </section>
      </div>
    </>
  );
}
