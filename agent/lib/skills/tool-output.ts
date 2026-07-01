import type { StoredSkill } from "#lib/storage/skills-repository.js";

export function toSkillToolOutput(skill: StoredSkill, options: { includeContent?: boolean } = {}) {
  return {
    id: skill.id,
    slug: skill.slug,
    version: skill.version,
    title: skill.title,
    description: skill.description,
    enabled: skill.enabled,
    active: skill.active,
    reviewStatus: skill.reviewStatus,
    priority: skill.priority,
    metadata: skill.metadata,
    supersedesId: skill.supersedesId,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    ...(options.includeContent ? { content: skill.content } : {}),
  };
}
