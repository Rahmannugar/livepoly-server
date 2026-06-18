SET search_path TO "public";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("users"."email" = lower("users"."email"));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_lowercase_chk" CHECK ("users"."username" = lower("users"."username"));