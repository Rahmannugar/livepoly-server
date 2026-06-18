SET search_path TO "public";--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_sequence_chk" CHECK ("game_events"."sequence" > 0);