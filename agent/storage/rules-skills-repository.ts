import { and, asc, eq } from "drizzle-orm";

import { getDb } from "./db.js";
import { getRedis } from "./redis.js";
import { type Rule, type Skill, type StorageMetadata, rules, skills } from "./schema.js";

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

  const created = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(rules)
      .where(and(eq(rules.slug, input.slug), eq(rules.active, true)))
      .limit(1);

    if (!current) {
      const [firstVersion] = await tx
        .insert(rules)
        .values({
          slug: input.slug,
          version: 1,
          title: input.title,
          content: input.content,
          scope: input.scope ?? "global",
          enabled: true,
          active: true,
          priority: input.priority ?? 0,
          metadata: input.metadata ?? {},
          updatedAt: now,
        })
        .returning();

      return firstVersion;
    }

    await tx
      .update(rules)
      .set({ active: false, enabled: false, updatedAt: now })
      .where(eq(rules.id, current.id));

    const [nextVersion] = await tx
      .insert(rules)
      .values({
        slug: input.slug,
        version: current.version + 1,
        title: input.title,
        content: input.content,
        scope: input.scope ?? current.scope,
        enabled: true,
        active: true,
        priority: input.priority ?? current.priority,
        metadata: input.metadata ?? current.metadata,
        supersedesId: current.id,
        updatedAt: now,
      })
      .returning();

    return nextVersion;
  });

  await invalidateRulesSkillsCache();
  return serializeRule(created);
}

export async function upsertSkillVersion(input: UpsertSkillVersionInput) {
  const db = getDb();
  const now = new Date();

  const created = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(skills)
      .where(and(eq(skills.slug, input.slug), eq(skills.active, true)))
      .limit(1);

    if (!current) {
      const [firstVersion] = await tx
        .insert(skills)
        .values({
          slug: input.slug,
          version: 1,
          title: input.title,
          description: input.description ?? null,
          content: input.content,
          enabled: true,
          active: true,
          priority: input.priority ?? 0,
          metadata: input.metadata ?? {},
          updatedAt: now,
        })
        .returning();

      return firstVersion;
    }

    await tx
      .update(skills)
      .set({ active: false, enabled: false, updatedAt: now })
      .where(eq(skills.id, current.id));

    const [nextVersion] = await tx
      .insert(skills)
      .values({
        slug: input.slug,
        version: current.version + 1,
        title: input.title,
        description: input.description ?? current.description,
        content: input.content,
        enabled: true,
        active: true,
        priority: input.priority ?? current.priority,
        metadata: input.metadata ?? current.metadata,
        supersedesId: current.id,
        updatedAt: now,
      })
      .returning();

    return nextVersion;
  });

  await invalidateRulesSkillsCache();
  return serializeSkill(created);
}

export async function invalidateRulesSkillsCache() {
  const redis = getRedis();
  await redis.del(RULES_CACHE_KEY, SKILLS_CACHE_KEY);
}

async function getCachedArray<T>(key: string, loadFromDb: () => Promise<T[]>) {
  const redis = getRedis();
  const cached = await readCachedArray<T>(redis, key);
  if (cached !== null) return cached;

  const items = await loadFromDb();
  await redis.set(key, JSON.stringify(items), { ex: CACHE_TTL_SECONDS });
  return items;
}

async function readCachedArray<T>(redis: ReturnType<typeof getRedis>, key: string) {
  const cached = await redis.get<unknown>(key);
  if (cached === null) return null;
  if (Array.isArray(cached)) return cached as T[];

  if (typeof cached === "string") {
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      return null;
    }
  }

  return null;
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
    priority: skill.priority,
    metadata: skill.metadata,
    supersedesId: skill.supersedesId,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}
