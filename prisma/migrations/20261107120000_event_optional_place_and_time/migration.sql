-- An event can be created before the place and the time are decided (D-175).
-- place_id NULL: the composite FK (place_id, club_id) is not checked (MATCH SIMPLE).
ALTER TABLE "events" ALTER COLUMN "place_id" DROP NOT NULL;

-- has_start_time = false: starts_at is midnight Copenhagen on the event's date
-- and ends_at the next midnight, so the event stays upcoming all day.
ALTER TABLE "events" ADD COLUMN "has_start_time" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "events"
  ADD CONSTRAINT "events_time_tbd_has_end_check" CHECK ("has_start_time" OR "ends_at" IS NOT NULL);
