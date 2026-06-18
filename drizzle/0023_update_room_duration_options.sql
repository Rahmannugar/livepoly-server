SET search_path TO "livepoly";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_duration_minutes_chk";--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_duration_minutes_chk" CHECK ("duration_minutes" in (90, 120));
