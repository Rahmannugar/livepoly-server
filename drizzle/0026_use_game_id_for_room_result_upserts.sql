SET search_path TO "public";--> statement-breakpoint
DROP INDEX IF EXISTS "room_results_room_id_unique_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_results_room_id_idx" ON "room_results" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "room_results_game_id_unique_idx" ON "room_results" USING btree ("game_id");
