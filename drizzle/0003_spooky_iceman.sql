ALTER TABLE "tapestry" ADD COLUMN "run_id" text;--> statement-breakpoint
CREATE INDEX "tapestry_run_id_idx" ON "tapestry" USING btree ("run_id");