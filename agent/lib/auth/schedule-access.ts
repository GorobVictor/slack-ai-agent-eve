import type { ToolContext } from "eve/tools";

const SKILL_ADMIN_USER_IDS_ENV = "SKILL_ADMIN_USER_IDS";

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
    isAdmin: getAllowedAdminUserIds().has(userId),
  };
}

function getAllowedAdminUserIds() {
  return new Set(
    (process.env[SKILL_ADMIN_USER_IDS_ENV] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function extractSlackUserId(ctx: ToolContext) {
  return ctx.session.auth.current?.attributes["user_id"] as string | undefined;
}
