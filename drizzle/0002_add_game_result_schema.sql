SET search_path TO "public";--> statement-breakpoint
CREATE TYPE "public"."game_end_reason" AS ENUM('bankruptcy', 'time_elapsed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leaderboard_period" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "leaderboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_type" "leaderboard_period" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"entries" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_after" integer NOT NULL,
	"rating_delta" integer NOT NULL,
	"placement" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_player_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat_number" integer NOT NULL,
	"starting_cash" integer NOT NULL,
	"final_cash" integer NOT NULL,
	"final_net_worth" integer NOT NULL,
	"placement" integer NOT NULL,
	"bankrupt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"winner_room_player_id" uuid NOT NULL,
	"winner_user_id" uuid,
	"end_reason" "game_end_reason" NOT NULL,
	"duration_seconds" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_player_results" ADD CONSTRAINT "room_player_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_winner_room_player_id_room_players_id_fk" FOREIGN KEY ("winner_room_player_id") REFERENCES "public"."room_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_results" ADD CONSTRAINT "room_results_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_snapshots_period_unique_idx" ON "leaderboard_snapshots" USING btree ("period_type","period_start","period_end");--> statement-breakpoint
CREATE INDEX "rating_history_user_id_idx" ON "rating_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rating_history_room_id_idx" ON "rating_history" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "rating_history_created_at_idx" ON "rating_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "room_player_results_room_user_unique_idx" ON "room_player_results" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_player_results_room_seat_unique_idx" ON "room_player_results" USING btree ("room_id","seat_number");--> statement-breakpoint
CREATE INDEX "room_player_results_room_id_idx" ON "room_player_results" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_player_results_user_id_idx" ON "room_player_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_player_results_placement_idx" ON "room_player_results" USING btree ("placement");--> statement-breakpoint
CREATE UNIQUE INDEX "room_results_room_id_unique_idx" ON "room_results" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_results_winner_user_id_idx" ON "room_results" USING btree ("winner_user_id");--> statement-breakpoint
CREATE INDEX "room_results_completed_at_idx" ON "room_results" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "room_results_winner_room_player_id_idx" ON "room_results" USING btree ("winner_room_player_id");