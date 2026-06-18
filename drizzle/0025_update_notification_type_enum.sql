UPDATE "notifications"
SET "type" = 'system'
WHERE "type" = 'game_started';--> statement-breakpoint

ALTER TYPE "public"."notification_type" RENAME TO "notification_type_old";--> statement-breakpoint

CREATE TYPE "public"."notification_type" AS ENUM(
  'friend_request',
  'friend_accepted',
  'room_invite',
  'leaderboard',
  'game_finished',
  'turn_reminder',
  'system'
);--> statement-breakpoint

ALTER TABLE "notifications"
ALTER COLUMN "type" TYPE "public"."notification_type"
USING "type"::text::"public"."notification_type";--> statement-breakpoint

DROP TYPE "public"."notification_type_old";
