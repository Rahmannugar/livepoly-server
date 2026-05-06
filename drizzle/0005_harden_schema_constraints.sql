ALTER TABLE "room_player_results" DROP CONSTRAINT "room_player_results_room_player_id_room_players_id_fk";
--> statement-breakpoint
ALTER TABLE "room_results" DROP CONSTRAINT "room_results_winner_room_player_id_room_players_id_fk";
--> statement-breakpoint
ALTER TABLE "room_results" ALTER COLUMN "winner_room_player_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_room_id_id_unique_idx" ON "room_players" USING btree ("room_id","id");--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_room_player_fk" FOREIGN KEY ("room_id","room_player_id") REFERENCES "public"."room_players"("room_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_winner_room_player_fk" FOREIGN KEY ("room_id","winner_room_player_id") REFERENCES "public"."room_players"("room_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_user_provider_unique_idx" ON "oauth_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_history_room_user_unique_idx" ON "rating_history" USING btree ("room_id","user_id");--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_games_played_chk" CHECK ("player_stats"."games_played" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_first_place_chk" CHECK ("player_stats"."first_place" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_second_place_chk" CHECK ("player_stats"."second_place" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_third_place_chk" CHECK ("player_stats"."third_place" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_fourth_place_chk" CHECK ("player_stats"."fourth_place" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_avg_position_chk" CHECK ("player_stats"."avg_position" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_current_rating_chk" CHECK ("player_stats"."current_rating" > 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_peak_rating_chk" CHECK ("player_stats"."peak_rating" > 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_total_net_worth_chk" CHECK ("player_stats"."total_net_worth" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_total_rent_collected_chk" CHECK ("player_stats"."total_rent_collected" >= 0);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_total_rent_paid_chk" CHECK ("player_stats"."total_rent_paid" >= 0);--> statement-breakpoint
ALTER TABLE "otp_tokens" ADD CONSTRAINT "otp_tokens_attempt_count_chk" CHECK ("otp_tokens"."attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_code_format_chk" CHECK ("rooms"."code" ~ '^[A-Za-z0-9]{8}$');--> statement-breakpoint
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_period_range_chk" CHECK ("leaderboard_snapshots"."period_start" <= "leaderboard_snapshots"."period_end");--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_placement_chk" CHECK ("rating_history"."placement" between 1 and 4);--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_rating_before_chk" CHECK ("rating_history"."rating_before" > 0);--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_rating_after_chk" CHECK ("rating_history"."rating_after" > 0);--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_seat_number_chk" CHECK ("room_player_results"."seat_number" between 1 and 4);--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_placement_chk" CHECK ("room_player_results"."placement" between 1 and 4);--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_starting_cash_chk" CHECK ("room_player_results"."starting_cash" >= 0);--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_final_net_worth_chk" CHECK ("room_player_results"."final_net_worth" >= 0);--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_winner_required_chk" CHECK (
    (
      "room_results"."end_reason" = 'cancelled'
      and "room_results"."winner_room_player_id" is null
      and "room_results"."winner_user_id" is null
    )
    or
    (
      "room_results"."end_reason" in ('bankruptcy', 'time_elapsed')
      and "room_results"."winner_room_player_id" is not null
    )
  );--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_duration_seconds_chk" CHECK ("room_results"."duration_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_read_state_chk" CHECK (
        (
          "notifications"."read" = false
          and "notifications"."read_at" is null
        )
        or
        (
          "notifications"."read" = true
          and "notifications"."read_at" is not null
        )
      );
