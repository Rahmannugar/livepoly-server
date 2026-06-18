SET search_path TO "public";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_duration_minutes_chk";--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_duration_minutes_chk" CHECK ("duration_minutes" in (90, 120));
