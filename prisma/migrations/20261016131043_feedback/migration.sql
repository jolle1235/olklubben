-- CreateEnum
CREATE TYPE "feedback_type" AS ENUM ('BUG', 'FEATURE');

-- CreateEnum
CREATE TYPE "feedback_status" AS ENUM ('NEW', 'PLANNED', 'IN_PROGRESS', 'DONE', 'WONT_DO', 'DUPLICATE');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "type" "feedback_type" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page_path" TEXT,
    "user_agent" TEXT,
    "viewport_width" INTEGER,
    "status" "feedback_status" NOT NULL DEFAULT 'NEW',
    "admin_response" TEXT,
    "duplicate_of_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_votes" (
    "feedback_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_votes_pkey" PRIMARY KEY ("feedback_id","user_id")
);

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_created_by_id_idx" ON "feedback"("created_by_id");

-- CreateIndex
CREATE INDEX "feedback_duplicate_of_id_idx" ON "feedback"("duplicate_of_id");

-- CreateIndex
CREATE INDEX "feedback_votes_user_id_idx" ON "feedback_votes"("user_id");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Hand edit: CHECK constraints (SPEC §9.9, §11, D-141) ───────────────────
-- Prisma cannot express CHECKs and ignores them when diffing (F-004: CHECKs
-- only, never raw indexes or FKs). The app validates first
-- (src/lib/validation/feedback.ts, src/server/domain/feedback/*); these guard
-- every writer, including scripts and hand-written SQL.

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_title_length_check"
  CHECK (char_length(btrim("title")) BETWEEN 3 AND 120 AND char_length("title") <= 120);

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_description_length_check"
  CHECK (char_length(btrim("description")) BETWEEN 10 AND 5000);

-- The page a bug came from: a path (never a URL), club id removed by the app (E26, D-143).
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_page_path_check"
  CHECK ("page_path" IS NULL OR (left("page_path", 1) = '/' AND char_length("page_path") <= 200));

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_agent_length_check"
  CHECK ("user_agent" IS NULL OR char_length("user_agent") BETWEEN 1 AND 500);

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_viewport_width_check"
  CHECK ("viewport_width" IS NULL OR "viewport_width" BETWEEN 1 AND 20000);

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_admin_response_length_check"
  CHECK ("admin_response" IS NULL OR char_length(btrim("admin_response")) BETWEEN 1 AND 2000);

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_duplicate_not_self_check"
  CHECK ("duplicate_of_id" IS NULL OR "duplicate_of_id" <> "id");

-- One way on purpose: deleting the original SETs NULL on its duplicates, which
-- stay DUPLICATE (E28). A two-way rule would make that FK action fail.
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_duplicate_status_check"
  CHECK ("duplicate_of_id" IS NULL OR "status" = 'DUPLICATE');

-- Page, browser and screen width are only stored for bugs (§9.9).
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_tech_info_bug_only_check"
  CHECK ("type" = 'BUG' OR ("page_path" IS NULL AND "user_agent" IS NULL AND "viewport_width" IS NULL));
