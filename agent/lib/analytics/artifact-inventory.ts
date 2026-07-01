import { getSkills } from "#lib/storage/skills-repository.js";

export type ArtifactInventory = {
  skills: Array<{
    slug: string;
    title: string;
    description: string | null;
    priority: number;
  }>;
};

export type ArtifactInventoryResult = {
  inventory: ArtifactInventory;
  warnings: string[];
};

const EMPTY_INVENTORY: ArtifactInventory = {
  skills: [],
};

export async function loadArtifactInventory(): Promise<ArtifactInventoryResult> {
  try {
    const skills = await getSkills();
    return {
      inventory: {
        skills: skills.map((skill) => ({
          slug: skill.slug,
          title: skill.title,
          description: skill.description,
          priority: skill.priority,
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
