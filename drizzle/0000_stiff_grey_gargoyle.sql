-- Baseline migration. The dev/prod DB already has account/session/tapestry/user/verification
-- from a prior (now-discarded) migration history. IF NOT EXISTS / DO blocks let us reapply
-- this baseline cleanly: existing objects are no-ops, only era_idea_tile (newly added) actually
-- gets created. From here on, drizzle-kit generate produces normal incremental migrations.

CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "era_idea_tile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anon_id" text,
	"run_id" text,
	"era_name" text NOT NULL,
	"tile_name" text NOT NULL,
	"tile_tier" integer NOT NULL,
	"tile_emoji" text NOT NULL,
	"tile_color" text NOT NULL,
	"tile_description" text,
	"tile_narrative" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tapestry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anon_id" text,
	"run_id" text,
	"bucket" text NOT NULL,
	"s3_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"era_name" text NOT NULL,
	"next_era_name" text NOT NULL,
	"narrative" text NOT NULL,
	"visibility" text NOT NULL,
	"game_data" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"anon_id" text,
	"last_active_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_anon_id_unique" UNIQUE("anon_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "era_idea_tile" ADD CONSTRAINT "era_idea_tile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tapestry" ADD CONSTRAINT "tapestry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "era_idea_tile_user_id_idx" ON "era_idea_tile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "era_idea_tile_anon_id_idx" ON "era_idea_tile" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "era_idea_tile_run_id_idx" ON "era_idea_tile" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "era_idea_tile_created_at_idx" ON "era_idea_tile" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tapestry_user_id_idx" ON "tapestry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tapestry_anon_id_idx" ON "tapestry" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tapestry_run_id_idx" ON "tapestry" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tapestry_created_at_idx" ON "tapestry" USING btree ("created_at");
