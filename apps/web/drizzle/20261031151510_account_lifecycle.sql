ALTER TYPE "public"."account_status" ADD VALUE 'PENDING_DELETION';--> statement-breakpoint
ALTER TYPE "public"."account_status" ADD VALUE 'CLOSED_RETAINED';--> statement-breakpoint
ALTER TYPE "public"."account_status" ADD VALUE 'ANONYMIZED';--> statement-breakpoint
CREATE TABLE "account_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_after" timestamp with time zone NOT NULL,
	"recovered_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"was_public" boolean DEFAULT false NOT NULL,
	"retention_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_after" timestamp with time zone,
	"last_error" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "account_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_by" uuid NOT NULL,
	"released_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"review_after" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"message" varchar(2000) NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_after" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_closures" ADD CONSTRAINT "account_closures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_holds" ADD CONSTRAINT "account_holds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_holds" ADD CONSTRAINT "account_holds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_holds" ADD CONSTRAINT "account_holds_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_closures_open_unique" ON "account_closures" USING btree ("user_id") WHERE "account_closures"."recovered_at" is null and "account_closures"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "account_closures_due_idx" ON "account_closures" USING btree ("process_after");--> statement-breakpoint
CREATE INDEX "account_holds_user_idx" ON "account_holds" USING btree ("user_id");