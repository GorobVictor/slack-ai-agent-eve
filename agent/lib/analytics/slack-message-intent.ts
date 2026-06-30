import { createHash } from "node:crypto";

import { generateText, Output } from "ai";
import { z } from "zod";

import type { StoredSlackMessageAnalysis } from "#lib/storage/slack-message-analytics-repository.js";
import type { StorageMetadata } from "#lib/storage/schema.js";
import {
  SLACK_MESSAGE_INTENT_PROMPT,
  SLACK_MESSAGE_INTENT_PROMPT_PATH,
} from "#lib/prompts/slack-message-intent-prompt.js";

const ANALYSIS_MODEL = process.env.SLACK_MESSAGE_ANALYSIS_MODEL ?? "google/gemma-4-31b-it";
const PROMPT_HASH = createHash("sha256").update(SLACK_MESSAGE_INTENT_PROMPT).digest("hex");

const intentSchema = z.object({
  intent: z
    .enum([
      "skill_improvement",
      "bug_report",
      "feature_request",
      "question",
      "task_request",
      "other",
    ])
    .describe("The single best intent category for the Slack message."),
  confidence: z.number().min(0).max(1).optional().describe("Confidence score from 0 to 1."),
  rationale: z.string().max(280).describe("Short explanation without private chain-of-thought."),
});

export type SlackMessageIntent = z.infer<typeof intentSchema>["intent"];

export type SlackMessageIntentAnalysis = {
  intent: SlackMessageIntent;
  metadata: StorageMetadata;
};

export async function analyzeSlackMessageIntent(
  message: StoredSlackMessageAnalysis
): Promise<SlackMessageIntentAnalysis> {
  const result = await generateText({
    model: ANALYSIS_MODEL,
    output: Output.object({
      name: "SlackMessageIntentAnalysis",
      description: "Intent classification for one Slack message sent to the Eve agent.",
      schema: intentSchema,
    }),
    prompt: [
      SLACK_MESSAGE_INTENT_PROMPT,
      "",
      "Slack message:",
      JSON.stringify(
        {
          teamId: message.teamId,
          channelId: message.channelId,
          threadTs: message.threadTs,
          messageTs: message.messageTs,
          userId: message.userId,
          userMessage: message.userMessage,
        },
        null,
        2
      ),
    ].join("\n"),
  });

  return {
    intent: result.output.intent,
    metadata: {
      analysis: {
        confidence: result.output.confidence ?? null,
        rationale: result.output.rationale,
        model: ANALYSIS_MODEL,
        responseModel: result.response.modelId,
        finishReason: result.finishReason,
        usage: result.usage,
        prompt: {
          path: SLACK_MESSAGE_INTENT_PROMPT_PATH,
          hash: PROMPT_HASH,
        },
      },
    },
  };
}
