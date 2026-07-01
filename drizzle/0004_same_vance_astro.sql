CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"cron" text NOT NULL,
	"markdown" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"owner_user_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_supersedes_id_schedules_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_owner_slug_version_unique" ON "schedules" USING btree ("owner_user_id","slug","version");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_active_owner_slug_unique" ON "schedules" USING btree ("owner_user_id","slug") WHERE "schedules"."active" = true;--> statement-breakpoint
CREATE INDEX "schedules_active_enabled_owner_slug_idx" ON "schedules" USING btree ("active","enabled","owner_user_id","slug");--> statement-breakpoint
CREATE INDEX "schedules_owner_created_at_idx" ON "schedules" USING btree ("owner_user_id","created_at");