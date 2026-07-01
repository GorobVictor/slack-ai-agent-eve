ALTER TABLE "skills" ADD COLUMN "review_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "slack_message_analytics" ADD COLUMN "artifact_generation_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "slack_message_analytics" ADD COLUMN "artifact_generation_error" text;--> statement-breakpoint
ALTER TABLE "slack_message_analytics" ADD COLUMN "artifact_generated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "slack_message_analytics_artifact_generation_idx" ON "slack_message_analytics" USING btree ("artifact_generation_status","analysis_status","created_at");