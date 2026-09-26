DROP INDEX "job_listings_discovery_idx";--> statement-breakpoint
CREATE INDEX "job_listings_budget_discovery_idx" ON "job_listings" USING btree ("status","budget_max","id");--> statement-breakpoint
CREATE INDEX "jobs_worker_status_idx" ON "jobs" USING btree ("worker_user_id","status");--> statement-breakpoint
CREATE INDEX "profiles_public_updated_idx" ON "profiles" USING btree ("is_public","updated_at","user_id");--> statement-breakpoint
CREATE INDEX "job_listings_discovery_idx" ON "job_listings" USING btree ("status","published_at","id");