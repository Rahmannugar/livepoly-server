CREATE TYPE "public"."job_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('queued', 'processing', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "user_avatar_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"content_length" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cleaned_up_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_avatar_uploads_status_chk" CHECK ("user_avatar_uploads"."status" in ('pending', 'confirmed', 'cleaned_up', 'expired')),
	CONSTRAINT "user_avatar_uploads_content_length_chk" CHECK ("user_avatar_uploads"."content_length" > 0)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "room_players_room_user_unique_idx";--> statement-breakpoint
DROP INDEX "room_spectators_room_user_unique_idx";--> statement-breakpoint
ALTER TABLE "user_avatar_uploads" ADD CONSTRAINT "user_avatar_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_avatar_uploads_object_key_unique_idx" ON "user_avatar_uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "user_avatar_uploads_user_status_idx" ON "user_avatar_uploads" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_avatar_uploads_expires_at_idx" ON "user_avatar_uploads" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_key_unique_idx" ON "jobs" USING btree ("key");--> statement-breakpoint
CREATE INDEX "jobs_status_available_at_idx" ON "jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "jobs_type_status_idx" ON "jobs" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_key_unique_idx" ON "outbox_events" USING btree ("key");--> statement-breakpoint
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_events_topic_status_idx" ON "outbox_events" USING btree ("topic","status");--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_active_room_user_unique_idx" ON "room_players" USING btree ("room_id","user_id") WHERE "room_players"."status" = 'joined' and "room_players"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "room_spectators_active_room_user_unique_idx" ON "room_spectators" USING btree ("room_id","user_id") WHERE "room_spectators"."left_at" is null;