import { getRulesAndSkills } from "#lib/storage/rules-skills-repository.js";

export type ArtifactInventory = {
  skills: Array<{
    slug: string;
    title: string;
    description: string | null;
    priority: number;
  }>;
  rules: Array<{
    slug: string;
    title: string;
    scope: string;
    priority: number;
  }>;
};

export type ArtifactInventoryResult = {
  inventory: ArtifactInventory;
  warnings: string[];
};

const EMPTY_INVENTORY: ArtifactInventory = {
  skills: [],
  rules: [],
};

export async function loadArtifactInventory(): Promise<ArtifactInventoryResult> {
  try {
    const { rules, skills } = await getRulesAndSkills();
    return {
      inventory: {
        skills: skills.map((skill) => ({
          slug: skill.slug,
          title: skill.title,
          description: skill.description,
          priority: skill.priority,
        })),
        rules: rules.map((rule) => ({
          slug: rule.slug,
          title: rule.title,
          scope: rule.scope,
          priority: rule.priority,
        })),
      },
      warnings: [],
    };
  } catch (error) {
    return {
      inventory: EMPTY_INVENTORY,
      warnings: [formatInventoryWarning(error)],
    };
  }
}

function formatInventoryWarning(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
