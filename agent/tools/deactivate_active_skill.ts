import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireSkillAdmin } from "#lib/auth/skill-admin.js";
import { toSkillToolOutput } from "#lib/skills/tool-output.js";
import { deactivateSkill } from "#lib/storage/skills-repository.js";

export default defineTool({
  description: "Deactivate an active DB-backed Eve skill so it no longer loads at runtime",
  inputSchema: z
    .object({
      id: z.string().min(1).optional().describe("Active skill id"),
      slug: z.string().min(1).optional().describe("Active skill slug"),
      reason: z.string().optional().describe("Optional reason for deactivation"),
    })
    .refine((input) => input.id || input.slug, {
      message: "Skill id or slug is required",
    }),
  async execute(input, ctx) {
    const admin = requireSkillAdmin(ctx);
    const skill = await deactivateSkill({
      id: input.id,
      slug: input.slug,
      reason: input.reason,
      deactivatedBy: admin.userId,
    });

    return {
      deactivated: true,
      skill: toSkillToolOutput(skill),
    };
  },
});
