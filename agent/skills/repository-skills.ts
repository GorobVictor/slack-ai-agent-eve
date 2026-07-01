import { defineDynamic, defineSkill, type SkillDefinition } from "eve/skills";

import { getSkills } from "../lib/storage/skills-repository.js";

export default defineDynamic({
  events: {
    "session.started": loadRepositorySkills,
    "turn.started": loadRepositorySkills,
  },
});

async function loadRepositorySkills() {
  const skills = await getSkills();
  if (skills.length === 0) return null;

  const entries: Record<string, SkillDefinition> = {};
  for (const skill of skills) {
    entries[getSkillKey(skill.slug, entries)] = defineSkill({
      description: skill.description ?? `Use when the request matches the ${skill.title} procedure.`,
      markdown: skill.content,
    });
  }

  return entries;
}

function getSkillKey(slug: string, entries: Record<string, SkillDefinition>) {
  const baseKey = `repo__${slugToSkillKey(slug)}`;
  if (!entries[baseKey]) return baseKey;

  let suffix = 2;
  while (entries[`${baseKey}__${suffix}`]) {
    suffix += 1;
  }
  return `${baseKey}__${suffix}`;
}

function slugToSkillKey(slug: string) {
  const key = slug.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return key || "skill";
}
