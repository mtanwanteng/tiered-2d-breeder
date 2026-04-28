-- Bibliophile retirement scaffolding (Phase 0).
--
-- Adds three columns and one index to the existing `era_idea_tile` table:
--   * chapter_index         integer NULL — cached order index of the era so library
--                                          queries don't depend on era-name string match
--   * binding_stripe_color  text NULL    — cached hash result for chromatic binding stripe
--   * retired_at            timestamp NULL — set when the player retires the tile (vault)
--   * idx era_idea_tile_retired_at_idx — drives library / vault filters
--
-- Why this file is ALTER-only and not the auto-generated CREATE+ALTER mix:
-- `era_idea_tile` and `bari_generated_map` were added to schema.ts after migration 0003
-- without committing migrations for them; the live DB has both tables (likely created via
-- `drizzle-kit push`). Running CREATE TABLE for those would fail. The ALTER-only form is
-- safe on any DB that's been kept in sync via push or migrate.
--
-- IF NOT EXISTS guards make this idempotent against partial application.

ALTER TABLE "era_idea_tile" ADD COLUMN IF NOT EXISTS "chapter_index" integer;--> statement-breakpoint
ALTER TABLE "era_idea_tile" ADD COLUMN IF NOT EXISTS "binding_stripe_color" text;--> statement-breakpoint
ALTER TABLE "era_idea_tile" ADD COLUMN IF NOT EXISTS "retired_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "era_idea_tile_retired_at_idx" ON "era_idea_tile" USING btree ("retired_at");
