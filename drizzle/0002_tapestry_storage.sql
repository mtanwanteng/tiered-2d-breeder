CREATE TABLE "tapestry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"anon_id" text,
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
ALTER TABLE "tapestry" ADD CONSTRAINT "tapestry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tapestry_user_id_idx" ON "tapestry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tapestry_anon_id_idx" ON "tapestry" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "tapestry_created_at_idx" ON "tapestry" USING btree ("created_at");