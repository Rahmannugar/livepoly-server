ALTER TYPE "public"."game_end_reason" ADD VALUE IF NOT EXISTS 'abandoned';--> statement-breakpoint
ALTER TABLE "room_results" DROP CONSTRAINT IF EXISTS "room_results_winner_required_chk";--> statement-breakpoint
-- Bot winners have no user id, so completed games require a winning room player,
-- not a winning user.
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_winner_required_chk" CHECK (
        (
          "room_results"."end_reason" = 'cancelled'
          and "room_results"."winner_room_player_id" is null
          and "room_results"."winner_user_id" is null
        )
        or
        (
          "room_results"."end_reason" in ('bankruptcy', 'time_elapsed', 'abandoned')
          and "room_results"."winner_room_player_id" is not null
        )
      );
