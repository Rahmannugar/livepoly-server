ALTER TABLE "player_stats" DROP CONSTRAINT "player_stats_current_rating_chk";--> statement-breakpoint
ALTER TABLE "player_stats" DROP CONSTRAINT "player_stats_peak_rating_chk";--> statement-breakpoint
ALTER TABLE "rating_history" DROP CONSTRAINT "rating_history_rating_before_chk";--> statement-breakpoint
ALTER TABLE "rating_history" DROP CONSTRAINT "rating_history_rating_after_chk";--> statement-breakpoint
ALTER TABLE "player_stats" ALTER COLUMN "current_rating" SET DEFAULT 500;--> statement-breakpoint
ALTER TABLE "player_stats" ALTER COLUMN "peak_rating" SET DEFAULT 500;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_current_rating_chk" CHECK ("player_stats"."current_rating" >= 300);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_peak_rating_chk" CHECK ("player_stats"."peak_rating" >= 300);--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_rating_before_chk" CHECK ("rating_history"."rating_before" >= 300);--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_rating_after_chk" CHECK ("rating_history"."rating_after" >= 300);