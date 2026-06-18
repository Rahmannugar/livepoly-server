SET search_path TO "public";--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
CREATE INDEX "games_status_expires_at_idx" ON "games" USING btree ("status","expires_at");
