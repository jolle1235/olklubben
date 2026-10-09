-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "location_text" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beers" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abv" DECIMAL(3,1) NOT NULL,
    "event_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "beers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beer_ratings" (
    "id" TEXT NOT NULL,
    "beer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "beer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_club_id_starts_at_idx" ON "events"("club_id", "starts_at");

-- CreateIndex
CREATE INDEX "beers_club_id_name_idx" ON "beers"("club_id", "name");

-- CreateIndex
CREATE INDEX "beers_event_id_idx" ON "beers"("event_id");

-- CreateIndex
CREATE INDEX "beer_ratings_user_id_idx" ON "beer_ratings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "beer_ratings_beer_id_user_id_key" ON "beer_ratings"("beer_id", "user_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beers" ADD CONSTRAINT "beers_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beers" ADD CONSTRAINT "beers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beers" ADD CONSTRAINT "beers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beer_ratings" ADD CONSTRAINT "beer_ratings_beer_id_fkey" FOREIGN KEY ("beer_id") REFERENCES "beers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beer_ratings" ADD CONSTRAINT "beer_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written constraints (SPEC §11, §15.4, D-034) ──────────────────────
-- Prisma cannot express CHECK constraints and ignores them when diffing, so
-- later `prisma migrate dev` runs leave them alone. The app trims and
-- validates first (src/lib/validation/event.ts, beer.ts, rating.ts); these
-- protect the invariants whatever writes to the tables.
-- Empty optional texts are stored as NULL, never as "".

ALTER TABLE "events"
  ADD CONSTRAINT "events_title_length_check"
  CHECK (char_length(btrim("title")) BETWEEN 1 AND 100);

ALTER TABLE "events"
  ADD CONSTRAINT "events_theme_length_check"
  CHECK ("theme" IS NULL OR char_length(btrim("theme")) BETWEEN 1 AND 80);

ALTER TABLE "events"
  ADD CONSTRAINT "events_description_length_check"
  CHECK ("description" IS NULL OR char_length(btrim("description")) BETWEEN 1 AND 5000);

-- D-022: the place is free text in round 2 (round 3 moves it to places).
ALTER TABLE "events"
  ADD CONSTRAINT "events_location_text_length_check"
  CHECK (char_length(btrim("location_text")) BETWEEN 1 AND 120);

ALTER TABLE "events"
  ADD CONSTRAINT "events_ends_after_start_check"
  CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

ALTER TABLE "beers"
  ADD CONSTRAINT "beers_name_length_check"
  CHECK (char_length(btrim("name")) BETWEEN 1 AND 120);

ALTER TABLE "beers"
  ADD CONSTRAINT "beers_abv_range_check"
  CHECK ("abv" >= 0 AND "abv" < 100);

-- Half points: 2 = 1,0 stars … 10 = 5,0 stars (D-003).
ALTER TABLE "beer_ratings"
  ADD CONSTRAINT "beer_ratings_value_range_check"
  CHECK ("value" BETWEEN 2 AND 10);
