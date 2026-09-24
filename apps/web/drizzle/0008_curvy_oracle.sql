ALTER TABLE "profiles" ALTER COLUMN "timezone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "timezone" DROP NOT NULL;