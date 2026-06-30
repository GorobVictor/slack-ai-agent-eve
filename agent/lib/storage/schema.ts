import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type StorageMetadata = Record<string, unknown>;
export type CacheValue = unknown;
export type SlackMessageAnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type ReviewStatus = "approved" | "review";
export type SlackArtifactGenerationStatus =
  | "pending"
  | "processing"
  | "review"
  | "skipped"
  | "failed";

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  };
}

export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    content: text("content").notNull(),
    scope: text("scope").notNull().default("global"),
    enabled: boolean("enabled").notNull().default(true),
    active: boolean("active").notNull().default(true),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("approved"),
    priority: integer("priority").notNull().default(0),
    metadata: jsonb("metadata").$type<StorageMetadata>().notNull().default(sql`'{}'::jsonb`),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => rules.id),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("rules_slug_version_unique").on(table.slug, table.version),
    uniqueIndex("rules_active_slug_unique").on(table.slug).where(sql`${table.active} = true`),
    index("rules_active_enabled_priority_slug_idx").on(
      table.active,
      table.enabled,
      table.priority,
      table.slug
    ),
  ]
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    description: text("description"),
    content: text("content").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    active: boolean("active").notNull().default(true),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("approved"),
    priority: integer("priority").notNull().default(0),
    metadata: jsonb("metadata").$type<StorageMetadata>().notNull().default(sql`'{}'::jsonb`),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => skills.id),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("skills_slug_version_unique").on(table.slug, table.version),
    uniqueIndex("skills_active_slug_unique").on(table.slug).where(sql`${table.active} = true`),
    index("skills_active_enabled_priority_slug_idx").on(
      table.active,
      table.enabled,
      table.priority,
      table.slug
    ),
  ]
);

export const cacheEntries = pgTable(
  "cache_entries",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").$type<CacheValue>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => [index("cache_entries_expires_at_idx").on(table.expiresAt)]
);

export const slackMessageAnalytics = pgTable(
  "slack_message_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: text("team_id").notNull(),
    channelId: text("channel_id").notNull(),
    threadTs: text("thread_ts").notNull(),
    messageTs: text("message_ts").notNull(),
    userId: text("user_id").notNull(),
    userMessage: text("user_message").notNull(),
    intent: text("intent"),
    analysisStatus: text("analysis_status")
      .$type<SlackMessageAnalysisStatus>()
      .notNull()
      .default("pending"),
    analysisError: text("analysis_error"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    artifactGenerationStatus: text("artifact_generation_status")
      .$type<SlackArtifactGenerationStatus>()
      .notNull()
      .default("pending"),
    artifactGenerationError: text("artifact_generation_error"),
    artifactGeneratedAt: timestamp("artifact_generated_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<StorageMetadata>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("slack_message_analytics_message_unique").on(
      table.teamId,
      table.channelId,
      table.messageTs
    ),
    index("slack_message_analytics_status_created_at_idx").on(
      table.analysisStatus,
      table.createdAt
    ),
    index("slack_message_analytics_artifact_generation_idx").on(
      table.artifactGenerationStatus,
      table.analysisStatus,
      table.createdAt
    ),
    index("slack_message_analytics_channel_created_at_idx").on(table.channelId, table.createdAt),
    index("slack_message_analytics_thread_created_at_idx").on(table.threadTs, table.createdAt),
  ]
);

export type Rule = typeof rules.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type SlackMessageAnalytics = typeof slackMessageAnalytics.$inferSelect;
