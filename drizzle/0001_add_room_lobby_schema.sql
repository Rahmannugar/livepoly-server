CREATE TYPE "public"."bot_difficulty" AS ENUM('easy', 'normal', 'hard');--> statement-breakpoint
CREATE TYPE "public"."room_player_status" AS ENUM('joined', 'left', 'kicked');--> statement-breakpoint
CREATE TYPE "public"."room_player_type" AS ENUM('human', 'bot');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'active', 'finished', 'cancelled');--> statement-breakpoint
CREATE TABLE "room_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid,
	"player_type" "room_player_type" NOT NULL,
	"bot_difficulty" "bot_difficulty",
	"bot_name" text,
	"seat_number" integer NOT NULL,
	"status" "room_player_status" DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "room_players_seat_number_chk" CHECK ("room_players"."seat_number" between 1 and 4),
	CONSTRAINT "room_players_human_or_bot_chk" CHECK (
        (
          "room_players"."player_type" = 'human'
          and "room_players"."user_id" is not null
          and "room_players"."bot_difficulty" is null
          and "room_players"."bot_name" is null
        )
        or
        (
          "room_players"."player_type" = 'bot'
          and "room_players"."user_id" is null
          and "room_players"."bot_difficulty" is not null
          and "room_players"."bot_name" is not null
        )
      )
);
--> statement-breakpoint
CREATE TABLE "room_spectators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"status" "room_status" DEFAULT 'waiting' NOT NULL,
	"max_players" integer DEFAULT 4 NOT NULL,
	"duration_minutes" integer NOT NULL,
	"board_key" text DEFAULT 'classic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "rooms_max_players_chk" CHECK ("rooms"."max_players" = 4),
	CONSTRAINT "rooms_duration_minutes_chk" CHECK ("rooms"."duration_minutes" in (30, 60, 120, 180))
);
--> statement-breakpoint
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_spectators" ADD CONSTRAINT "room_spectators_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_spectators" ADD CONSTRAINT "room_spectators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_room_user_unique_idx" ON "room_players" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_active_room_seat_unique_idx" ON "room_players" USING btree ("room_id","seat_number") WHERE "room_players"."status" = 'joined';--> statement-breakpoint
CREATE INDEX "room_players_room_id_idx" ON "room_players" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_players_user_id_idx" ON "room_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_players_player_type_idx" ON "room_players" USING btree ("player_type");--> statement-breakpoint
CREATE UNIQUE INDEX "room_spectators_room_user_unique_idx" ON "room_spectators" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "room_spectators_room_id_idx" ON "room_spectators" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_spectators_user_id_idx" ON "room_spectators" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_unique_idx" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rooms_host_user_id_idx" ON "rooms" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "rooms_status_idx" ON "rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rooms_created_at_idx" ON "rooms" USING btree ("created_at");