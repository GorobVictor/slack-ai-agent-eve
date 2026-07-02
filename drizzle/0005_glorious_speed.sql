ALTER TABLE "schedules" ADD COLUMN "next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "lease_token" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "last_dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "last_dispatch_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "last_dispatch_error" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "dispatch_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "schedules" SET "next_run_at" = now() WHERE "enabled" = true AND "active" = true;--> statement-breakpoint
CREATE INDEX "schedules_active_enabled_next_run_lease_idx" ON "schedules" USING btree ("active","enabled","next_run_at","lease_expires_at");