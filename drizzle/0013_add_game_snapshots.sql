SET search_path TO "public";--> statement-breakpoint
CREATE TYPE "public"."game_snapshot_type" AS ENUM('start', 'turn', 'final');--> statement-breakpoint
CREATE TABLE "game_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"snapshot_type" "game_snapshot_type" NOT NULL,
	"turn_number" integer NOT NULL,
	"state" jsonb NOT NULL,
	"state_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_snapshots_turn_number_chk" CHECK ("game_snapshots"."turn_number" > 0),
	CONSTRAINT "game_snapshots_state_version_chk" CHECK ("game_snapshots"."state_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "game_snapshots" ADD CONSTRAINT "game_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_snapshots" ADD CONSTRAINT "game_snapshots_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_snapshots_game_id_idx" ON "game_snapshots" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_snapshots_room_id_idx" ON "game_snapshots" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "game_snapshots_snapshot_type_idx" ON "game_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "game_snapshots_created_at_idx" ON "game_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "game_snapshots_game_turn_idx" ON "game_snapshots" USING btree ("game_id","turn_number");--> statement-breakpoint
CREATE INDEX "game_snapshots_game_created_at_idx" ON "game_snapshots" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_snapshots_game_type_turn_unique_idx" ON "game_snapshots" USING btree ("game_id","snapshot_type","turn_number");