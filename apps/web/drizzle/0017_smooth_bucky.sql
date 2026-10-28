CREATE TABLE "client_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"project_title" varchar(90) DEFAULT '' NOT NULL,
	"message" varchar(2000) DEFAULT '' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"status" varchar(10) DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"recipient_user_id" uuid,
	"job_id" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_invites_status_check" CHECK ("client_invites"."status" in ('PENDING','ACCEPTED','DECLINED','EXPIRED','REVOKED')),
	CONSTRAINT "client_invites_not_self" CHECK ("client_invites"."recipient_user_id" is null or "client_invites"."owner_user_id" <> "client_invites"."recipient_user_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_invites" ADD CONSTRAINT "client_invites_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invites" ADD CONSTRAINT "client_invites_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invites" ADD CONSTRAINT "client_invites_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_invites_token_unique" ON "client_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "client_invites_pending_unique" ON "client_invites" USING btree ("owner_user_id","email") WHERE "client_invites"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "client_invites_job_unique" ON "client_invites" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "client_invites_recipient_idx" ON "client_invites" USING btree ("recipient_user_id");