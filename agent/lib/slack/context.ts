import type { ToolContext } from "eve/tools";

export type SlackToolContext = {
  channelId: string;
  threadTs: string;
  teamId: string | null;
  userId: string;
};

export function requireSlackToolContext(ctx: ToolContext): SlackToolContext {
  const auth = ctx.session.auth.current;
  if (auth?.authenticator !== "slack-webhook") {
    throw new Error("This Slack delivery tool must be called from a Slack session");
  }

  const channelId = getStringAttribute(auth.attributes, "channel_id");
  const threadTs = getStringAttribute(auth.attributes, "thread_ts");
  const userId = getStringAttribute(auth.attributes, "user_id");
  const teamId = getStringAttribute(auth.attributes, "team_id") ?? null;

  if (!channelId || !threadTs || !userId) {
    throw new Error("Slack channel, thread, and user attributes are required");
  }

  return {
    channelId,
    threadTs,
    teamId,
    userId,
  };
}

function getStringAttribute(attributes: Record<string, unknown>, key: string) {
  const value = attributes[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
