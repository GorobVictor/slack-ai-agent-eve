CREATE TABLE "slack_message_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_ts" text NOT NULL,
	"message_ts" text NOT NULL,
	"user_id" text NOT NULL,
	"user_message" text NOT NULL,
	"intent" text,
	"analysis_status" text DEFAULT 'pending' NOT NULL,
	"analysis_error" text,
	"analyzed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "slack_message_analytics_message_unique" ON "slack_message_analytics" USING btree ("team_id","channel_id","message_ts");--> statement-breakpoint
CREATE INDEX "slack_message_analytics_status_created_at_idx" ON "slack_message_analytics" USING btree ("analysis_status","created_at");--> statement-breakpoint
CREATE INDEX "slack_message_analytics_channel_created_at_idx" ON "slack_message_analytics" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "slack_message_analytics_thread_created_at_idx" ON "slack_message_analytics" USING btree ("thread_ts","created_at");