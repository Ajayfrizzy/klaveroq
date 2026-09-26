CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" varchar(20) DEFAULT 'EMAIL' NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"text_body" text NOT NULL,
	"html_body" text NOT NULL,
	"dedupe_key" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"proposal_emails" boolean DEFAULT true NOT NULL,
	"message_emails" boolean DEFAULT true NOT NULL,
	"job_emails" boolean DEFAULT true NOT NULL,
	"dispute_emails" boolean DEFAULT true NOT NULL,
	"support_emails" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_thread_reads" (
	"proposal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_thread_reads_proposal_id_user_id_pk" PRIMARY KEY("proposal_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" varchar(200);--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_thread_reads" ADD CONSTRAINT "proposal_thread_reads_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_thread_reads" ADD CONSTRAINT "proposal_thread_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_dedupe_unique" ON "notification_deliveries" USING btree ("channel","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_delivery_retry_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "proposal_thread_reads_user_idx" ON "proposal_thread_reads" USING btree ("user_id","last_read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_dedupe_unique" ON "notifications" USING btree ("user_id","dedupe_key");