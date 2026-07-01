import { and, asc, desc, eq, sql } from "drizzle-orm";

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

export type GetSkillReviewCandidatesInput = {
  slug?: string;
  limit?: number;
};

export type GetActiveSkillsInput = {
  slug?: string;
  limit?: number;
};

export type ApproveSkillReviewCandidateInput = {
  id: string;
  approvedBy?: string;
};

export type DeactivateSkillInput = {
  id?: string;
  slug?: string;
  deactivatedBy?: string;
  reason?: string;
};

export type SoftDeleteSkillInput = {
  id: string;
  deletedBy?: string;
  reason?: string;
};

export async function getSkills() {
  return getCachedArray(SKILLS_CACHE_KEY, loadSkillsFromDb);
}

export async function getSkillReviewCandidates(input: GetSkillReviewCandidatesInput = {}) {
  const where = [eq(skills.reviewStatus, "review" as const)];
  if (input.slug) where.push(eq(skills.slug, input.slug));

  const rows = await getDb()
    .select()
    .from(skills)
    .where(and(...where))
    .orderBy(desc(skills.createdAt), asc(skills.slug))
    .limit(input.limit ?? 20);

  return rows.map(serializeSkill);
}

export async function getActiveSkills(input: GetActiveSkillsInput = {}) {
  const where = [eq(skills.enabled, true), eq(skills.active, true)];
  if (input.slug) where.push(eq(skills.slug, input.slug));

  const rows = await getDb()
    .select()
    .from(skills)
    .where(and(...where))
    .orderBy(asc(skills.priority), asc(skills.slug))
    .limit(input.limit ?? 50);

  return rows.map(serializeSkill);
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

export async function approveSkillReviewCandidate(input: ApproveSkillReviewCandidateInput) {
  const now = new Date();
  const approved = await getDb().transaction(async (tx) => {
    const [candidate] = await tx.select().from(skills).where(eq(skills.id, input.id)).limit(1);

    if (!candidate) {
      throw new Error(`Skill review candidate not found: ${input.id}`);
    }

    if (candidate.reviewStatus !== "review") {
      throw new Error(`Skill is not waiting for review: ${candidate.slug} v${candidate.version}`);
    }

    const [current] = await tx
      .select()
      .from(skills)
      .where(and(eq(skills.slug, candidate.slug), eq(skills.active, true)))
      .limit(1);

    if (current && current.id !== candidate.id) {
      await tx
        .update(skills)
        .set({ active: false, enabled: false, updatedAt: now })
        .where(eq(skills.id, current.id));
    }

    const [updated] = await tx
      .update(skills)
      .set({
        enabled: true,
        active: true,
        reviewStatus: "approved",
        metadata: withLifecycleMetadata(candidate.metadata, {
          approvedAt: now.toISOString(),
          approvedBy: input.approvedBy,
        }),
        updatedAt: now,
      })
      .where(eq(skills.id, candidate.id))
      .returning();

    return updated;
  });

  await invalidateSkillsCache();
  return serializeSkill(approved);
}

export async function deactivateSkill(input: DeactivateSkillInput) {
  if (!input.id && !input.slug) {
    throw new Error("Skill id or slug is required");
  }

  const db = getDb();
  const now = new Date();
  const where = input.id
    ? eq(skills.id, input.id)
    : and(eq(skills.slug, input.slug as string), eq(skills.active, true));

  const [skill] = await db.select().from(skills).where(where).limit(1);
  if (!skill) {
    throw new Error(input.id ? `Skill not found: ${input.id}` : `Active skill not found: ${input.slug}`);
  }
  if (!skill.active || !skill.enabled) {
    throw new Error(`Skill is not active: ${skill.slug} v${skill.version}`);
  }

  const [updated] = await db
    .update(skills)
    .set({
      enabled: false,
      active: false,
      metadata: withLifecycleMetadata(skill.metadata, {
        deactivatedAt: now.toISOString(),
        deactivatedBy: input.deactivatedBy,
        deactivationReason: input.reason,
      }),
      updatedAt: now,
    })
    .where(eq(skills.id, skill.id))
    .returning();

  await invalidateSkillsCache();
  return serializeSkill(updated);
}

export async function softDeleteSkill(input: SoftDeleteSkillInput) {
  const db = getDb();
  const now = new Date();
  const [skill] = await db.select().from(skills).where(eq(skills.id, input.id)).limit(1);

  if (!skill) {
    throw new Error(`Skill not found: ${input.id}`);
  }

  const [updated] = await db
    .update(skills)
    .set({
      enabled: false,
      active: false,
      reviewStatus: "deleted",
      metadata: withLifecycleMetadata(skill.metadata, {
        deletedAt: now.toISOString(),
        deletedBy: input.deletedBy,
        deleteReason: input.reason,
      }),
      updatedAt: now,
    })
    .where(eq(skills.id, skill.id))
    .returning();

  await invalidateSkillsCache();
  return serializeSkill(updated);
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

function withLifecycleMetadata(
  metadata: StorageMetadata,
  lifecycleUpdate: Record<string, string | undefined>
) {
  return {
    ...metadata,
    lifecycle: {
      ...(isRecord(metadata.lifecycle) ? metadata.lifecycle : {}),
      ...withoutUndefined(lifecycleUpdate),
    },
  };
}

function withoutUndefined(input: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
