import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireScheduleAccess } from "#lib/auth/schedule-access.js";
import { toScheduleToolOutput } from "#lib/schedules/tool-output.js";
import { getActiveSchedules } from "#lib/storage/schedules-repository.js";

export default defineTool({
  description: "List active DB-backed Eve schedules owned by the current Slack user",
  inputSchema: z.object({
    slug: z.string().optional().describe("Optional schedule slug to filter by"),
    limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of schedules"),
    includeMarkdown: z.boolean().default(false).describe("Include full schedule markdown prompt"),
    includeAllOwners: z
      .boolean()
      .default(false)
      .describe("Admin-only: include schedules owned by all users"),
  }),
  async execute(input, ctx) {
    const access = requireScheduleAccess(ctx);
    if (input.includeAllOwners && !access.isAdmin) {
      throw new Error("Only schedule admins can list schedules for all owners");
    }

    const schedules = await getActiveSchedules({
      ownerUserId: input.includeAllOwners ? undefined : access.userId,
      slug: input.slug,
      limit: input.limit,
    });

    return {
      count: schedules.length,
      schedules: schedules.map((schedule) =>
        toScheduleToolOutput(schedule, { includeMarkdown: input.includeMarkdown })
      ),
    };
  },
});
