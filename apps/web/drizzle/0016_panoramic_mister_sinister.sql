CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" varchar(8) NOT NULL,
	"name" varchar(60) NOT NULL,
	"query" varchar(2048) NOT NULL,
	"slot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_searches_scope_check" CHECK ("saved_searches"."scope" in ('discover', 'talent')),
	CONSTRAINT "saved_searches_slot_check" CHECK ("saved_searches"."slot" between 0 and 7),
	CONSTRAINT "saved_searches_name_check" CHECK (length(trim("saved_searches"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "talent_shortlist_items" (
	"user_id" uuid NOT NULL,
	"talent_user_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talent_shortlist_items_user_id_talent_user_id_pk" PRIMARY KEY("user_id","talent_user_id"),
	CONSTRAINT "talent_shortlist_slot_check" CHECK ("talent_shortlist_items"."slot" between 0 and 2),
	CONSTRAINT "talent_shortlist_not_self" CHECK ("talent_shortlist_items"."user_id" <> "talent_shortlist_items"."talent_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"workspace_focus" varchar(4) DEFAULT 'both' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_focus_check" CHECK ("user_preferences"."workspace_focus" in ('hire', 'work', 'both'))
);
--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_shortlist_items" ADD CONSTRAINT "talent_shortlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_shortlist_items" ADD CONSTRAINT "talent_shortlist_items_talent_user_id_users_id_fk" FOREIGN KEY ("talent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_slot_unique" ON "saved_searches" USING btree ("user_id","scope","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_query_unique" ON "saved_searches" USING btree ("user_id","scope","query");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_shortlist_slot_unique" ON "talent_shortlist_items" USING btree ("user_id","slot");