SET search_path TO "livepoly";--> statement-breakpoint
UPDATE "notifications"
SET "type" = 'system'
WHERE "type" = 'game_started';--> statement-breakpoint

ALTER TYPE "livepoly"."notification_type" RENAME TO "notification_type_old";--> statement-breakpoint

CREATE TYPE "livepoly"."notification_type" AS ENUM(
  'friend_request',
  'friend_accepted',
  'room_invite',
  'leaderboard',
  'game_finished',
  'turn_reminder',
  'system'
);--> statement-breakpoint

ALTER TABLE "notifications"
ALTER COLUMN "type" TYPE "livepoly"."notification_type"
USING "type"::text::"livepoly"."notification_type";--> statement-breakpoint

DROP TYPE "livepoly"."notification_type_old";
