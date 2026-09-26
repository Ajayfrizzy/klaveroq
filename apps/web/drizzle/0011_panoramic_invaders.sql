CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"scan_status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"alt_text" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_file_size_valid" CHECK ("media_files"."size_bytes" > 0 AND "media_files"."size_bytes" <= 26214400)
);
--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_file_storage_key_unique" ON "media_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "media_file_owner_idx" ON "media_files" USING btree ("owner_user_id","created_at");