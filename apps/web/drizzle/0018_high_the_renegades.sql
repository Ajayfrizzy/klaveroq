CREATE TYPE "public"."vellum_claim_issuance_status" AS ENUM('PREPARING', 'PREPARED', 'SUBMITTED', 'CONFIRMED', 'REVIEW_REQUIRED');--> statement-breakpoint
CREATE TABLE "vellum_claim_issuances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"settlement_operation_id" uuid NOT NULL,
	"subject_did" varchar(80) NOT NULL,
	"issuer_did" varchar(80) NOT NULL,
	"payload" jsonb NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"status" "vellum_claim_issuance_status" DEFAULT 'PREPARING' NOT NULL,
	"lease_token" uuid NOT NULL,
	"claim_id" varchar(66),
	"output_index" integer,
	"signed_transaction" text,
	"transaction_hash" varchar(66),
	"last_error_code" varchar(80),
	"confirmed_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vellum_claim_issuance_revision_positive" CHECK ("vellum_claim_issuances"."revision" > 0),
	CONSTRAINT "vellum_claim_issuance_prepared_fields" CHECK ("vellum_claim_issuances"."status" = 'PREPARING' OR ("vellum_claim_issuances"."claim_id" IS NOT NULL AND "vellum_claim_issuances"."output_index" IS NOT NULL AND "vellum_claim_issuances"."output_index" >= 0 AND "vellum_claim_issuances"."signed_transaction" IS NOT NULL AND "vellum_claim_issuances"."transaction_hash" IS NOT NULL)),
	CONSTRAINT "vellum_claim_issuance_confirmation_fields" CHECK (("vellum_claim_issuances"."status" = 'CONFIRMED' AND "vellum_claim_issuances"."confirmed_at" IS NOT NULL) OR ("vellum_claim_issuances"."status" <> 'CONFIRMED' AND "vellum_claim_issuances"."confirmed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "vellum_identity_bindings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"wallet_id" uuid NOT NULL,
	"did" varchar(80) NOT NULL,
	"display_name" varchar(160),
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vellum_issuer_leases" (
	"key" varchar(32) PRIMARY KEY NOT NULL,
	"token" uuid NOT NULL,
	"issuance_id" uuid,
	"transaction_hash" varchar(66),
	"expires_at" timestamp with time zone NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vellum_issuer_lease_revision_positive" CHECK ("vellum_issuer_leases"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "vellum_claim_issuances" ADD CONSTRAINT "vellum_claim_issuances_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vellum_claim_issuances" ADD CONSTRAINT "vellum_claim_issuances_settlement_operation_id_operations_id_fk" FOREIGN KEY ("settlement_operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vellum_identity_bindings" ADD CONSTRAINT "vellum_identity_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vellum_identity_bindings" ADD CONSTRAINT "vellum_identity_bindings_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vellum_issuer_leases" ADD CONSTRAINT "vellum_issuer_leases_issuance_id_vellum_claim_issuances_id_fk" FOREIGN KEY ("issuance_id") REFERENCES "public"."vellum_claim_issuances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vellum_claim_issuance_milestone_unique" ON "vellum_claim_issuances" USING btree ("milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vellum_claim_issuance_operation_unique" ON "vellum_claim_issuances" USING btree ("settlement_operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vellum_claim_issuance_claim_unique" ON "vellum_claim_issuances" USING btree ("claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vellum_claim_issuance_transaction_unique" ON "vellum_claim_issuances" USING btree ("transaction_hash");--> statement-breakpoint
CREATE INDEX "vellum_claim_issuance_subject_idx" ON "vellum_claim_issuances" USING btree ("subject_did");--> statement-breakpoint
CREATE INDEX "vellum_claim_issuance_status_idx" ON "vellum_claim_issuances" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vellum_identity_did_unique" ON "vellum_identity_bindings" USING btree ("did");--> statement-breakpoint
CREATE INDEX "vellum_identity_wallet_idx" ON "vellum_identity_bindings" USING btree ("wallet_id");