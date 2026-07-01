import { getSkills } from "#lib/storage/skills-repository.js";
import { getActiveSchedules } from "#lib/storage/schedules-repository.js";

export type ArtifactInventory = {
  skills: Array<{
    slug: string;
    title: string;
    description: string | null;
    priority: number;
  }>;
  schedules: Array<{
    slug: string;
    title: string;
    cron: string;
    ownerUserId: string;
  }>;
};

export type ArtifactInventoryResult = {
  inventory: ArtifactInventory;
  warnings: string[];
};

const EMPTY_INVENTORY: ArtifactInventory = {
  skills: [],
  schedules: [],
};

export type LoadArtifactInventoryInput = {
  scheduleOwnerUserId?: string;
};

export async function loadArtifactInventory(
  input: LoadArtifactInventoryInput = {}
): Promise<ArtifactInventoryResult> {
  try {
    const [skills, schedules] = await Promise.all([
      getSkills(),
      getActiveSchedules({
        ownerUserId: input.scheduleOwnerUserId,
        limit: 100,
      }),
    ]);

    return {
      inventory: {
        skills: skills.map((skill) => ({
          slug: skill.slug,
          title: skill.title,
          description: skill.description,
          priority: skill.priority,
        })),
        schedules: schedules.map((schedule) => ({
          slug: schedule.slug,
          title: schedule.title,
          cron: schedule.cron,
          ownerUserId: schedule.ownerUserId,
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
