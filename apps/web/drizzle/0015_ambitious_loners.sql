CREATE TABLE "email_delivery_rollout" (
	"id" integer PRIMARY KEY NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "notification_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "category" varchar(30) DEFAULT 'JOB' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "first_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "provider_event_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_provider_unique" ON "notification_deliveries" USING btree ("provider_id");
--> statement-breakpoint
INSERT INTO "email_delivery_rollout" ("id") VALUES (1);
--> statement-breakpoint
-- Old code could not distinguish simulation from acceptance. Preserve these
-- records without claiming receipt or automatically resending historical mail.
-- Keep the historical timestamp as unverified evidence, not a delivery receipt.
UPDATE "notification_deliveries" SET "status" = 'LEGACY_UNCONFIRMED',
  "last_error" = 'LEGACY_DELIVERY_UNVERIFIED' WHERE "status" = 'DELIVERED';
--> statement-breakpoint
UPDATE "notification_deliveries" SET "status" = 'REVIEW_REQUIRED',
  "last_error" = 'LEGACY_RETRY_REQUIRES_REVIEW' WHERE "status" IN ('PENDING', 'FAILED', 'PROCESSING');
