import type { ToolContext } from "eve/tools";

import { extractSlackUserId, getAllowedSkillAdminUserIds } from "./skill-admin.js";

export type ScheduleAccessContext = {
  userId: string;
  isAdmin: boolean;
};

export function requireScheduleAccess(ctx: ToolContext): ScheduleAccessContext {
  const userId = extractSlackUserId(ctx);
  if (!userId) {
    throw new Error("A Slack user id is required to manage schedules");
  }

  return {
    userId,
    isAdmin: getAllowedSkillAdminUserIds().has(userId),
  };
}
