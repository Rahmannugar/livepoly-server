SET search_path TO "public";--> statement-breakpoint
CREATE TYPE "public"."game_mode" AS ENUM('ranked', 'casual');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'finished', 'cancelled');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"mode" "game_mode" NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"current_turn_room_player_id" uuid NOT NULL,
	"turn_number" integer DEFAULT 1 NOT NULL,
	"state" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_turn_number_chk" CHECK ("games"."turn_number" > 0),
	CONSTRAINT "games_finished_state_chk" CHECK (
        (
          "games"."status" = 'active'
          and "games"."finished_at" is null
        )
        or
        (
          "games"."status" in ('finished', 'cancelled')
          and "games"."finished_at" is not null
        )
      )
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_current_turn_room_player_fk" FOREIGN KEY ("room_id","current_turn_room_player_id") REFERENCES "public"."room_players"("room_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_room_id_unique_idx" ON "games" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "games_mode_idx" ON "games" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "games_current_turn_room_player_id_idx" ON "games" USING btree ("current_turn_room_player_id");