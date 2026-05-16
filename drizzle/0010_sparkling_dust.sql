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
ALTER TABLE "user_avatar_uploads" ADD CONSTRAINT "user_avatar_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_avatar_uploads_object_key_unique_idx" ON "user_avatar_uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "user_avatar_uploads_user_status_idx" ON "user_avatar_uploads" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_avatar_uploads_expires_at_idx" ON "user_avatar_uploads" USING btree ("expires_at");