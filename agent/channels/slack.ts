import { connectSlackCredentials } from "@vercel/connect/eve";
import {
  defaultSlackAuth,
  loadThreadContextMessages,
  slackChannel,
  type SlackContext,
  type SlackMessage,
} from "eve/channels/slack";

import { recordSlackUserMessage } from "#lib/storage/slack-message-analytics-repository.js";

export default slackChannel({
  credentials: connectSlackCredentials("slack/eve"),
  async onAppMention(ctx, message) {
    return handleSlackMessage(ctx, message);
  },
  async onDirectMessage(ctx, message) {
    return handleSlackMessage(ctx, message);
  },
});

async function handleSlackMessage(ctx: SlackContext, message: SlackMessage) {
  const auth = defaultSlackAuth(message, ctx);
  await recordIncomingSlackMessage(message);

  const prior = await loadThreadContextMessages(ctx.thread, message, {
    since: "last-agent-reply",
  });
  if (prior.length === 0) return { auth };
  const transcript = prior
    .map((m) => `${m.isMe ? "you" : (m.user ?? "user")}: ${m.markdown}`)
    .join("\n");
  return { auth, context: [`Recent thread messages since your last reply:\n\n${transcript}`] };
}

async function recordIncomingSlackMessage(message: SlackMessage) {
  try {
    await recordSlackUserMessage({
      teamId: message.teamId ?? "unknown",
      channelId: message.channelId,
      threadTs: message.threadTs,
      messageTs: message.ts,
      userId: message.author?.userId ?? "unknown",
      userMessage: message.markdown || message.text,
      metadata: {
        source: "slack",
        eventType: "app_mention",
        slack: {
          attachmentCount: message.attachments.length,
          author: message.author
            ? {
                userName: message.author.userName,
                fullName: message.author.fullName,
                isBot: message.author.isBot,
                isMe: message.author.isMe,
              }
            : null,
          hasRawEvent: Object.keys(message.raw).length > 0,
        },
      },
    });
  } catch (error) {
    console.error("Failed to record Slack message analytics", error);
  }
}
