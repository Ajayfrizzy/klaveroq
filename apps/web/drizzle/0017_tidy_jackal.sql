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
ALTER TABLE "vellum_identity_bindings" ADD CONSTRAINT "vellum_identity_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vellum_identity_bindings" ADD CONSTRAINT "vellum_identity_bindings_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vellum_identity_did_unique" ON "vellum_identity_bindings" USING btree ("did");--> statement-breakpoint
CREATE INDEX "vellum_identity_wallet_idx" ON "vellum_identity_bindings" USING btree ("wallet_id");