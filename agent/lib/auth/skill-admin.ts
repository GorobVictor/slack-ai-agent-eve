import type { ToolContext } from "eve/tools";

const SKILL_ADMIN_USER_IDS_ENV = "SKILL_ADMIN_USER_IDS";

export type SkillAdminContext = {
  userId: string;
};

export function requireSkillAdmin(ctx: ToolContext): SkillAdminContext {
  return requireAllowedSkillAdminUserId(extractSlackUserId(ctx), ctx);
}

export function requireSkillAdminUserId(userId: string | undefined): SkillAdminContext {
  return requireAllowedSkillAdminUserId(userId);
}

export function getAllowedSkillAdminUserIds() {
  return new Set(
    (process.env[SKILL_ADMIN_USER_IDS_ENV] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function extractSlackUserId(ctx: ToolContext) {
  return ctx.session.auth.current?.attributes["user_id"] as string | undefined;
}

function requireAllowedSkillAdminUserId(
  userId: string | undefined,
  unauthorizedCause?: unknown
): SkillAdminContext {
  const allowedUserIds = getAllowedSkillAdminUserIds();
  if (allowedUserIds.size === 0) {
    throw new Error(`${SKILL_ADMIN_USER_IDS_ENV} must be configured before changing skills`);
  }

  if (!userId || !allowedUserIds.has(userId)) {
    if (unauthorizedCause) {
      throw new Error("Unauthorized skill admin action", { cause: unauthorizedCause });
    }

    throw new Error("Unauthorized skill admin action");
  }

  return { userId };
}
