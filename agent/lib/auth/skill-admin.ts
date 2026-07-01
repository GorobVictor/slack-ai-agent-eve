const SKILL_ADMIN_USER_IDS_ENV = "SKILL_ADMIN_USER_IDS";

export type SkillAdminContext = {
  userId: string;
};

export function requireSkillAdmin(ctx: unknown): SkillAdminContext {
  const allowedUserIds = getAllowedSkillAdminUserIds();
  if (allowedUserIds.size === 0) {
    throw new Error(`${SKILL_ADMIN_USER_IDS_ENV} must be configured before changing skills`);
  }

  const userId = extractSlackUserId(ctx);
  if (!userId || !allowedUserIds.has(userId)) {
    throw new Error("Unauthorized skill admin action");
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

function extractSlackUserId(ctx: unknown) {
  const candidates = [
    ["session", "auth", "current", "userId"],
    ["session", "auth", "current", "slackUserId"],
    ["session", "auth", "current", "id"],
    ["session", "auth", "current", "subject"],
    ["session", "auth", "initiator", "userId"],
    ["session", "auth", "initiator", "slackUserId"],
    ["session", "auth", "initiator", "id"],
    ["session", "auth", "initiator", "subject"],
    ["auth", "current", "userId"],
    ["auth", "current", "slackUserId"],
    ["auth", "current", "id"],
    ["auth", "current", "subject"],
    ["userId"],
    ["slackUserId"],
  ];

  for (const path of candidates) {
    const value = getPath(ctx, path);
    if (typeof value === "string" && value.length > 0) return normalizeSlackUserId(value);
  }

  return null;
}

function normalizeSlackUserId(value: string) {
  const slackUserId = value.match(/\b[UW][A-Z0-9]+\b/u)?.[0];
  return slackUserId ?? value;
}

function getPath(value: unknown, path: string[]) {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
