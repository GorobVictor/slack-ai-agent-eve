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

export type Rule = typeof rules.$inferSelect;
export type Skill = typeof skills.$inferSelect;
