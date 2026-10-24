-- Beer photos (SPEC §9.5, D-158). The composite FK keeps a photo in its beer's club
-- (D-096); beers_id_club_id_key is its target. beer_images_beer_id_club_id_key
-- is what Prisma needs for the one-to-one relation over (beer_id, club_id).

-- CreateTable
CREATE TABLE "beer_images" (
    "beer_id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "beer_images_pkey" PRIMARY KEY ("beer_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beer_images_beer_id_club_id_key" ON "beer_images"("beer_id", "club_id");

-- CreateIndex
CREATE UNIQUE INDEX "beers_id_club_id_key" ON "beers"("id", "club_id");

-- AddForeignKey
ALTER TABLE "beer_images" ADD CONSTRAINT "beer_images_beer_id_club_id_fkey" FOREIGN KEY ("beer_id", "club_id") REFERENCES "beers"("id", "club_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only what the server writes: WebP from sharp, ≤ 1 MB, ≤ 1200 × 1200 px.
ALTER TABLE "beer_images"
  ADD CONSTRAINT "beer_images_content_type_check" CHECK ("content_type" = 'image/webp'),
  ADD CONSTRAINT "beer_images_size_check" CHECK (octet_length("data") BETWEEN 1 AND 1048576),
  ADD CONSTRAINT "beer_images_dimensions_check"
    CHECK ("width" BETWEEN 1 AND 1200 AND "height" BETWEEN 1 AND 1200);
