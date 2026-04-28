-- Bibliophile Phase 7: user accessibility / preference settings.
--
-- Defaults are baked into the column definitions so the migration is safe on
-- a populated `user` table — existing rows pick up the defaults at ALTER time.
-- IF NOT EXISTS guards make the migration idempotent (per repo convention,
-- see 0004_dear_ultragirl.sql).

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "seen_first_retirement_speech" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "prefers_reduced_motion" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "prefers_tap_to_commit" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "prefers_high_contrast" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "room_tone_enabled" boolean NOT NULL DEFAULT true;
