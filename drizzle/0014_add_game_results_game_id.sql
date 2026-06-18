SET search_path TO "public";--> statement-breakpoint
ALTER TABLE "room_results" DROP CONSTRAINT "room_results_winner_required_chk";--> statement-breakpoint
ALTER TABLE "room_results" ADD COLUMN "game_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_results_game_id_unique_idx" ON "room_results" USING btree ("game_id");--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_final_cash_chk" CHECK ("room_player_results"."final_cash" >= 0);--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_winner_required_chk" CHECK (
        (
          "room_results"."end_reason" = 'cancelled'
          and "room_results"."winner_room_player_id" is null
          and "room_results"."winner_user_id" is null
        )
        or
        (
          "room_results"."end_reason" = 'bankruptcy'
          and "room_results"."winner_room_player_id" is not null
        )
        or
        (
          "room_results"."end_reason" = 'time_elapsed'
          and (
            "room_results"."winner_room_player_id" is not null
            or "room_results"."winner_user_id" is null
          )
        )
      );