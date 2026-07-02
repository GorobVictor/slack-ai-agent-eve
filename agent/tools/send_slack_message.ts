import { defineTool } from "eve/tools";
import { z } from "zod";

import { openSlackDirectMessage, postSlackMessage } from "#lib/slack/api.js";
import { requireSlackToolContext } from "#lib/slack/context.js";

const targetSchema = z.enum(["thread", "dm"]);

export default defineTool({
  description:
    "Send a Slack message to the current thread or a direct message when the user asks or delivery is useful",
  inputSchema: z.object({
    target: targetSchema.default("thread").describe("Where to send the Slack message"),
    markdown: z
      .string()
      .min(1)
      .max(40_000)
      .describe("Message body in Slack-compatible markdown. Do not include secrets."),
    channelId: z.string().min(1).optional().describe("Optional Slack channel override for thread posts"),
    threadTs: z.string().min(1).optional().describe("Optional Slack thread timestamp override"),
    userId: z
      .string()
      .min(1)
      .optional()
      .describe("Optional Slack user id for DMs. Defaults to the triggering user."),
  }),
  async execute(input, ctx) {
    const slack = requireSlackToolContext(ctx);
    const target = await resolveTarget(input, slack);
    const posted = await postSlackMessage({
      channelId: target.channelId,
      threadTs: target.threadTs,
      markdown: input.markdown,
    });

    return {
      sent: true,
      target: input.target,
      channelId: posted.channelId,
      messageTs: posted.messageTs,
      threadTs: target.threadTs,
    };
  },
});

async function resolveTarget(
  input: {
    target: z.infer<typeof targetSchema>;
    channelId?: string;
    threadTs?: string;
    userId?: string;
  },
  slack: ReturnType<typeof requireSlackToolContext>
) {
  if (input.target === "dm") {
    const channelId = await openSlackDirectMessage(input.userId ?? slack.userId);
    return {
      channelId,
      threadTs: undefined,
    };
  }

  return {
    channelId: input.channelId ?? slack.channelId,
    threadTs: input.threadTs ?? slack.threadTs,
  };
}
