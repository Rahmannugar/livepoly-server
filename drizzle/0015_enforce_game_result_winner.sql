SET search_path TO "public";--> statement-breakpoint
ALTER TABLE "room_results" DROP CONSTRAINT "room_results_winner_required_chk";--> statement-breakpoint
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
      );