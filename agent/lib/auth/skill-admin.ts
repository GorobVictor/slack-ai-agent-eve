import type { ToolContext } from "eve/tools";

const SKILL_ADMIN_USER_IDS_ENV = "SKILL_ADMIN_USER_IDS";

export type SkillAdminContext = {
  userId: string;
};

export function requireSkillAdmin(ctx: ToolContext): SkillAdminContext {
  const allowedUserIds = getAllowedSkillAdminUserIds();
  if (allowedUserIds.size === 0) {
    throw new Error(`${SKILL_ADMIN_USER_IDS_ENV} must be configured before changing skills`);
  }

  const userId = extractSlackUserId(ctx);
  if (!userId || !allowedUserIds.has(userId)) {
    throw new Error("Unauthorized skill admin action", { cause: ctx });
  }

  return { userId };
}

function getAllowedSkillAdminUserIds() {
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
