CREATE TABLE "dispute_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" varchar(50) NOT NULL,
	"detail" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"scan_status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_file_size_valid" CHECK ("dispute_files"."size_bytes" > 0 AND "dispute_files"."size_bytes" <= 26214400)
);
--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD COLUMN "required_approver_id" uuid;--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_files" ADD CONSTRAINT "dispute_files_evidence_id_dispute_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."dispute_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_event_history_idx" ON "dispute_events" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_file_storage_key_unique" ON "dispute_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "dispute_file_evidence_idx" ON "dispute_files" USING btree ("evidence_id");--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_required_approver_id_users_id_fk" FOREIGN KEY ("required_approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_decision_dispute_unique" ON "dispute_decisions" USING btree ("dispute_id");--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decision_distinct_approvers" CHECK ("dispute_decisions"."decided_by" <> "dispute_decisions"."required_approver_id");
