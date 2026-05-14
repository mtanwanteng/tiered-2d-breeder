-- Phase F: per-user theme preference.
--
-- Adds the `theme_preference` column on the `user` table. Default 'bibliophile'
-- so existing rows pick it up at ALTER time without a backfill. IF NOT EXISTS
-- guard keeps the migration idempotent (per repo convention, see
-- 0005_overconfident_epoch.sql).
--
-- Validation of the value (bibliophile | curator | cartographer) lives in the
-- application layer rather than as a CHECK constraint so future themes can be
-- added without a schema migration.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "theme_preference" text NOT NULL DEFAULT 'bibliophile';
