-- Switch the DB-level default on `theme_preference` from 'bibliophile' to
-- 'curator'. This only affects future INSERTs that omit the column (the ORM
-- side is covered by $defaultFn in src/db/schema.ts). Existing user rows are
-- untouched — players who set Bibliophile or Cartographer keep their choice.

ALTER TABLE "user" ALTER COLUMN "theme_preference" SET DEFAULT 'curator';
