SET search_path TO "livepoly";--> statement-breakpoint
CREATE INDEX "friendships_requester_status_created_idx" ON "friendships" USING btree ("requester_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "friendships_addressee_status_created_idx" ON "friendships" USING btree ("addressee_id","status","created_at","id");