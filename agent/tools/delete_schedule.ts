import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireScheduleAccess } from "#lib/auth/schedule-access.js";
import { toScheduleToolOutput } from "#lib/schedules/tool-output.js";
import { softDeleteSchedule } from "#lib/storage/schedules-repository.js";

export default defineTool({
  description: "Soft-delete a DB-backed Eve schedule owned by the current Slack user",
  inputSchema: z.object({
    id: z.string().min(1).describe("Schedule id to soft-delete"),
    reason: z.string().optional().describe("Optional reason for deletion"),
  }),
  async execute(input, ctx) {
    const access = requireScheduleAccess(ctx);
    const schedule = await softDeleteSchedule({
      id: input.id,
      requesterUserId: access.userId,
      isAdmin: access.isAdmin,
      reason: input.reason,
    });

    return {
      deleted: true,
      schedule: toScheduleToolOutput(schedule, { includeMarkdown: true }),
    };
  },
});
