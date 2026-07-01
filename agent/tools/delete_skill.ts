import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireSkillAdmin } from "#lib/auth/skill-admin.js";
import { toSkillToolOutput } from "#lib/skills/tool-output.js";
import { softDeleteSkill } from "#lib/storage/skills-repository.js";

export default defineTool({
  description: "Soft-delete a DB-backed Eve skill so it is hidden from review and runtime lists",
  inputSchema: z.object({
    id: z.string().min(1).describe("Skill id to soft-delete"),
    reason: z.string().optional().describe("Optional reason for deletion"),
  }),
  async execute(input, ctx) {
    const admin = requireSkillAdmin(ctx);
    const skill = await softDeleteSkill({
      id: input.id,
      reason: input.reason,
      deletedBy: admin.userId,
    });

    return {
      deleted: true,
      skill: toSkillToolOutput(skill),
    };
  },
});
