import { and, asc, eq, sql } from "drizzle-orm";

import { deleteCacheValues, getCacheValue, setCacheValue } from "./cache.js";
import { getDb } from "./db.js";
import { type ReviewStatus, type Skill, type StorageMetadata, skills } from "./schema.js";

const SKILLS_CACHE_KEY = "eve:skills:v1";
const CACHE_TTL_SECONDS = 5 * 60;

export type StoredSkill = {
  id: string;
  slug: string;
  version: number;
  title: string;
  description: string | null;
  content: string;
  enabled: boolean;
  active: boolean;
  reviewStatus: ReviewStatus;
  priority: number;
  metadata: StorageMetadata;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertSkillVersionInput = {
  slug: string;
  title: string;
  description?: string | null;
  content: string;
  priority?: number;
  metadata?: StorageMetadata;
};

export type CreateSkillReviewCandidateInput = {
  slug: string;
  title: string;
  description?: string | null;
  content: string;
  priority?: number;
  metadata?: StorageMetadata;
};

export async function getSkills() {
  return getCachedArray(SKILLS_CACHE_KEY, loadSkillsFromDb);
}

export async function upsertSkillVersion(input: UpsertSkillVersionInput) {
  const db = getDb();
  const now = new Date();

  const [current] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.slug, input.slug), eq(skills.active, true)))
    .limit(1);

  const version = await getNextSkillVersion(input.slug);

  if (!current) {
    const [firstVersion] = await db
      .insert(skills)
      .values({
        slug: input.slug,
        version,
        title: input.title,
        description: input.description ?? null,
        content: input.content,
        enabled: true,
        active: true,
        reviewStatus: "approved",
        priority: input.priority ?? 0,
        metadata: input.metadata ?? {},
        updatedAt: now,
      })
      .returning();

    await invalidateSkillsCache();
    return serializeSkill(firstVersion);
  }

  await db
    .update(skills)
    .set({ active: false, enabled: false, updatedAt: now })
    .where(eq(skills.id, current.id));

  const [created] = await db
    .insert(skills)
    .values({
      slug: input.slug,
      version,
      title: input.title,
      description: input.description ?? current.description,
      content: input.content,
      enabled: true,
      active: true,
      reviewStatus: "approved",
      priority: input.priority ?? current.priority,
      metadata: input.metadata ?? current.metadata,
      supersedesId: current.id,
      updatedAt: now,
    })
    .returning();

  await invalidateSkillsCache();
  return serializeSkill(created);
}

export async function createSkillReviewCandidate(input: CreateSkillReviewCandidateInput) {
  const db = getDb();
  const now = new Date();

  const [created] = await db
    .insert(skills)
    .values({
      slug: input.slug,
      version: await getNextSkillVersion(input.slug),
      title: input.title,
      description: input.description ?? null,
      content: input.content,
      enabled: false,
      active: false,
      reviewStatus: "review",
      priority: input.priority ?? 0,
      metadata: input.metadata ?? {},
      updatedAt: now,
    })
    .returning();

  return serializeSkill(created);
}

export async function invalidateSkillsCache() {
  await deleteCacheValues([SKILLS_CACHE_KEY]);
}

async function getCachedArray<T>(key: string, loadFromDb: () => Promise<T[]>) {
  const cached = await getCacheValue<T[]>(key);
  if (cached !== null) return cached;

  const items = await loadFromDb();
  await setCacheValue(key, items, CACHE_TTL_SECONDS);
  return items;
}

async function loadSkillsFromDb() {
  const rows = await getDb()
    .select()
    .from(skills)
    .where(and(eq(skills.enabled, true), eq(skills.active, true)))
    .orderBy(asc(skills.priority), asc(skills.slug));

  return rows.map(serializeSkill);
}

async function getNextSkillVersion(slug: string) {
  const [row] = await getDb()
    .select({ nextVersion: sql<number>`coalesce(max(${skills.version}), 0) + 1` })
    .from(skills)
    .where(eq(skills.slug, slug));

  return Number(row?.nextVersion ?? 1);
}

function serializeSkill(skill: Skill): StoredSkill {
  return {
    id: skill.id,
    slug: skill.slug,
    version: skill.version,
    title: skill.title,
    description: skill.description,
    content: skill.content,
    enabled: skill.enabled,
    active: skill.active,
    reviewStatus: skill.reviewStatus,
    priority: skill.priority,
    metadata: skill.metadata,
    supersedesId: skill.supersedesId,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}
