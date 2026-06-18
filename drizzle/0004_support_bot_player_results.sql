SET search_path TO "livepoly";--> statement-breakpoint
DROP INDEX "room_player_results_room_user_unique_idx";--> statement-breakpoint
ALTER TABLE "room_player_results" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "room_player_results" ADD COLUMN "room_player_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_room_player_id_room_players_id_fk" FOREIGN KEY ("room_player_id") REFERENCES "livepoly"."room_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_player_results_room_player_unique_idx" ON "room_player_results" USING btree ("room_id","room_player_id");--> statement-breakpoint
CREATE INDEX "room_player_results_room_player_id_idx" ON "room_player_results" USING btree ("room_player_id");