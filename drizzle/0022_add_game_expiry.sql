ALTER TABLE "games" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "games"
SET "expires_at" = COALESCE(
  to_timestamp((("state"->>'expiresAt')::double precision) / 1000),
  "started_at" + interval '60 minutes'
)
WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "games_status_expires_at_idx" ON "games" USING btree ("status","expires_at");
