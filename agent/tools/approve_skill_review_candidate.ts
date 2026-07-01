import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireSkillAdmin } from "#lib/auth/skill-admin.js";
import { toSkillToolOutput } from "#lib/skills/tool-output.js";
import { approveSkillReviewCandidate } from "#lib/storage/skills-repository.js";

export default defineTool({
  description: "Approve a DB-backed Eve skill review candidate and make it active",
  inputSchema: z.object({
    id: z.string().min(1).describe("Skill review candidate id"),
  }),
  async execute(input, ctx) {
    const admin = requireSkillAdmin(ctx);
    const skill = await approveSkillReviewCandidate({
      id: input.id,
      approvedBy: admin.userId,
    });

    return {
      approved: true,
      skill: toSkillToolOutput(skill, { includeContent: true }),
    };
  },
});
