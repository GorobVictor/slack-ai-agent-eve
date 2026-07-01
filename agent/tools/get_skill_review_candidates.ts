import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireSkillAdmin } from "#lib/auth/skill-admin.js";
import { toSkillToolOutput } from "#lib/skills/tool-output.js";
import { getSkillReviewCandidates } from "#lib/storage/skills-repository.js";

export default defineTool({
  description: "List DB-backed Eve skills that are waiting for review",
  inputSchema: z.object({
    slug: z.string().optional().describe("Optional skill slug to filter by"),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of candidates"),
    includeContent: z.boolean().default(false).describe("Include full markdown skill content"),
  }),
  async execute(input, ctx) {
    requireSkillAdmin(ctx);
    const skills = await getSkillReviewCandidates({
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
