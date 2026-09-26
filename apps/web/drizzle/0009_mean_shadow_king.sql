CREATE TABLE "auth_rate_limits" (
	"action" varchar(40) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_rate_limits_action_key_hash_pk" PRIMARY KEY("action","key_hash")
);
