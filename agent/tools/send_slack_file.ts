import { defineTool } from "eve/tools";
import { z } from "zod";

import { openSlackDirectMessage, uploadSlackTextFile } from "#lib/slack/api.js";
import { requireSlackToolContext } from "#lib/slack/context.js";

const targetSchema = z.enum(["thread", "dm"]);

export default defineTool({
  description:
    "Upload a generated text file to the current Slack thread or a direct message when a file is useful",
  inputSchema: z.object({
    target: targetSchema.default("thread").describe("Where to upload the file"),
    filename: z
      .string()
      .min(1)
      .max(120)
      .describe("Filename for the uploaded text file, for example report.md"),
    content: z.string().min(1).max(500_000).describe("Text file contents. Do not include secrets."),
    initialComment: z
      .string()
      .max(4_000)
      .optional()
      .describe("Optional message shown with the uploaded file"),
    channelId: z.string().min(1).optional().describe("Optional Slack channel override for thread uploads"),
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
    const uploaded = await uploadSlackTextFile({
      channelId: target.channelId,
      threadTs: target.threadTs,
      filename: input.filename,
      content: input.content,
      initialComment: input.initialComment,
    });

    return {
      uploaded: true,
      target: input.target,
      channelId: target.channelId,
      threadTs: target.threadTs,
      fileIds: uploaded.fileIds,
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
