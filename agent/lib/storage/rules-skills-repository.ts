import { and, asc, eq, sql } from "drizzle-orm";

import { deleteCacheValues, getCacheValue, setCacheValue } from "./cache.js";
import { getDb } from "./db.js";
import {
  type ReviewStatus,
  type Rule,
  type Skill,
  type StorageMetadata,
  rules,
  skills,
} from "./schema.js";

const RULES_CACHE_KEY = "eve:rules:v1";
const SKILLS_CACHE_KEY = "eve:skills:v1";
const CACHE_TTL_SECONDS = 5 * 60;

export type StoredRule = {
  id: string;
  slug: string;
  version: number;
  title: string;
  content: string;
  scope: string;
  enabled: boolean;
  active: boolean;
  reviewStatus: ReviewStatus;
  priority: number;
  metadata: StorageMetadata;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
};

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

export type UpsertRuleVersionInput = {
  slug: string;
  title: string;
  content: string;
  scope?: string;
  priority?: number;
  metadata?: StorageMetadata;
};

export type UpsertSkillVersionInput = {
  slug: string;
  title: string;
  description?: string | null;
  content: string;
  priority?: number;
  metadata?: StorageMetadata;
};

export type CreateRuleReviewCandidateInput = {
  slug: string;
  title: string;
  content: string;
  scope?: string;
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

export async function getRules() {
  return getCachedArray(RULES_CACHE_KEY, loadRulesFromDb);
}

export async function getSkills() {
  return getCachedArray(SKILLS_CACHE_KEY, loadSkillsFromDb);
}

export async function getRulesAndSkills() {
  const [ruleItems, skillItems] = await Promise.all([getRules(), getSkills()]);
  return { rules: ruleItems, skills: skillItems };
}

export async function upsertRuleVersion(input: UpsertRuleVersionInput) {
  const db = getDb();
  const now = new Date();

  const [current] = await db
    .select()
    .from(rules)
    .where(and(eq(rules.slug, input.slug), eq(rules.active, true)))
    .limit(1);

  const version = await getNextRuleVersion(input.slug);

  if (!current) {
    const [firstVersion] = await db
      .insert(rules)
      .values({
        slug: input.slug,
        version,
        title: input.title,
        content: input.content,
        scope: input.scope ?? "global",
        enabled: true,
        active: true,
        reviewStatus: "approved",
        priority: input.priority ?? 0,
        metadata: input.metadata ?? {},
        updatedAt: now,
      })
      .returning();

    await invalidateRulesSkillsCache();
    return serializeRule(firstVersion);
  }

  await db
    .update(rules)
    .set({ active: false, enabled: false, updatedAt: now })
    .where(eq(rules.id, current.id));

  const [created] = await db
    .insert(rules)
    .values({
      slug: input.slug,
      version,
      title: input.title,
      content: input.content,
      scope: input.scope ?? current.scope,
      enabled: true,
      active: true,
      reviewStatus: "approved",
      priority: input.priority ?? current.priority,
      metadata: input.metadata ?? current.metadata,
      supersedesId: current.id,
      updatedAt: now,
    })
    .returning();

  await invalidateRulesSkillsCache();
  return serializeRule(created);
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

    await invalidateRulesSkillsCache();
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

  await invalidateRulesSkillsCache();
  return serializeSkill(created);
}

export async function createRuleReviewCandidate(input: CreateRuleReviewCandidateInput) {
  const db = getDb();
  const now = new Date();

  const [created] = await db
    .insert(rules)
    .values({
      slug: input.slug,
      version: await getNextRuleVersion(input.slug),
      title: input.title,
      content: input.content,
      scope: input.scope ?? "global",
      enabled: false,
      active: false,
      reviewStatus: "review",
      priority: input.priority ?? 0,
      metadata: input.metadata ?? {},
      updatedAt: now,
    })
    .returning();

  return serializeRule(created);
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

export async function invalidateRulesSkillsCache() {
  await deleteCacheValues([RULES_CACHE_KEY, SKILLS_CACHE_KEY]);
}

async function getCachedArray<T>(key: string, loadFromDb: () => Promise<T[]>) {
  const cached = await getCacheValue<T[]>(key);
  if (cached !== null) return cached;

  const items = await loadFromDb();
  await setCacheValue(key, items, CACHE_TTL_SECONDS);
  return items;
}

async function loadRulesFromDb() {
  const rows = await getDb()
    .select()
    .from(rules)
    .where(and(eq(rules.enabled, true), eq(rules.active, true)))
    .orderBy(asc(rules.priority), asc(rules.slug));

  return rows.map(serializeRule);
}

async function loadSkillsFromDb() {
  const rows = await getDb()
    .select()
    .from(skills)
    .where(and(eq(skills.enabled, true), eq(skills.active, true)))
    .orderBy(asc(skills.priority), asc(skills.slug));

  return rows.map(serializeSkill);
}

async function getNextRuleVersion(slug: string) {
  const [row] = await getDb()
    .select({ nextVersion: sql<number>`coalesce(max(${rules.version}), 0) + 1` })
    .from(rules)
    .where(eq(rules.slug, slug));

  return Number(row?.nextVersion ?? 1);
}

async function getNextSkillVersion(slug: string) {
  const [row] = await getDb()
    .select({ nextVersion: sql<number>`coalesce(max(${skills.version}), 0) + 1` })
    .from(skills)
    .where(eq(skills.slug, slug));

  return Number(row?.nextVersion ?? 1);
}

function serializeRule(rule: Rule): StoredRule {
  return {
    id: rule.id,
    slug: rule.slug,
    version: rule.version,
    title: rule.title,
    content: rule.content,
    scope: rule.scope,
    enabled: rule.enabled,
    active: rule.active,
    reviewStatus: rule.reviewStatus,
    priority: rule.priority,
    metadata: rule.metadata,
    supersedesId: rule.supersedesId,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
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
