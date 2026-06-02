CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_events_game_id_sequence_unique_idx" ON "game_events" USING btree ("game_id","sequence");--> statement-breakpoint
CREATE INDEX "game_events_game_id_sequence_idx" ON "game_events" USING btree ("game_id","sequence");--> statement-breakpoint
CREATE INDEX "game_events_game_id_created_at_idx" ON "game_events" USING btree ("game_id","created_at");