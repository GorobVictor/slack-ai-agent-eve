CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_supersedes_id_skills_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_version_unique" ON "skills" USING btree ("slug","version");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_active_slug_unique" ON "skills" USING btree ("slug") WHERE "skills"."active" = true;--> statement-breakpoint
CREATE INDEX "skills_active_enabled_priority_slug_idx" ON "skills" USING btree ("active","enabled","priority","slug");