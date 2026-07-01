import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireSkillAdmin } from "#lib/auth/skill-admin.js";
import { toSkillToolOutput } from "#lib/skills/tool-output.js";
import { getActiveSkills } from "#lib/storage/skills-repository.js";

export default defineTool({
  description: "List active DB-backed Eve skills currently eligible for runtime loading",
  inputSchema: z.object({
    slug: z.string().optional().describe("Optional skill slug to filter by"),
    limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of skills"),
    includeContent: z.boolean().default(false).describe("Include full markdown skill content"),
  }),
  async execute(input, ctx) {
    requireSkillAdmin(ctx);
    const skills = await getActiveSkills({
      slug: input.slug,
      limit: input.limit,
    });

    return {
      count: skills.length,
      skills: skills.map((skill) =>
        toSkillToolOutput(skill, { includeContent: input.includeContent })
      ),
    };
  },
});
