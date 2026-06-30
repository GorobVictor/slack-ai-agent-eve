import { createHash } from "node:crypto";

import { generateText, Output } from "ai";
import { z } from "zod";

import { loadArtifactInventory } from "./artifact-inventory.js";
import type { StoredSlackMessageAnalysis } from "#lib/storage/slack-message-analytics-repository.js";
import type { StorageMetadata } from "#lib/storage/schema.js";
import {
  SLACK_MESSAGE_INTENT_PROMPT,
  SLACK_MESSAGE_INTENT_PROMPT_PATH,
} from "#lib/prompts/slack-message-intent-prompt.js";

const ANALYSIS_MODEL = process.env.SLACK_MESSAGE_ANALYSIS_MODEL ?? "google/gemma-4-31b-it";
const PROMPT_HASH = createHash("sha256").update(SLACK_MESSAGE_INTENT_PROMPT).digest("hex");

const intentOptions = ["skill.create", "skill.improve", "rule.create", "rule.improve", "none"] as const;
const targetOptions = ["skill", "rule", "none"] as const;
const actionOptions = ["create", "improve", "none"] as const;

const intentSchema = z.object({
  intent: z.enum(intentOptions).describe("The durable artifact action implied by the Slack message."),
  target: z.enum(targetOptions).optional().describe("The artifact type to create or improve."),
  action: z.enum(actionOptions).optional().describe("Whether to create or improve the target artifact."),
  actionable: z.boolean().optional().describe("Whether this message is useful for autogeneration."),
  confidence: z.number().min(0).max(1).optional().describe("Confidence score from 0 to 1."),
  rationale: z.string().max(280).describe("Short explanation without private chain-of-thought."),
  evidence: z.string().max(500).optional().describe("The part of the user message that supports this classification."),
  existingArtifact: z
    .string()
    .nullable()
    .optional()
    .describe("Existing DB skill/rule slug when the intent is an improvement."),
  suggestedArtifactName: z
    .string()
    .nullable()
    .optional()
    .describe("Suggested slug/name for a new artifact when the intent is create."),
  suggestedChange: z
    .string()
    .nullable()
    .optional()
    .describe("Short suggested change for a create or improve action."),
});

export type SlackMessageIntent = z.infer<typeof intentSchema>["intent"];
type SlackMessageTarget = z.infer<typeof intentSchema>["target"];
type SlackMessageAction = z.infer<typeof intentSchema>["action"];

export type SlackMessageIntentAnalysis = {
  intent: SlackMessageIntent;
  metadata: StorageMetadata;
};

export async function analyzeSlackMessageIntent(
  message: StoredSlackMessageAnalysis
): Promise<SlackMessageIntentAnalysis> {
  const { inventory, warnings } = await loadArtifactInventory();
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
      "",
      "Existing active and enabled DB artifacts:",
      JSON.stringify(inventory, null, 2),
    ].join("\n"),
  });
  const target = result.output.target ?? targetFromIntent(result.output.intent);
  const action = result.output.action ?? actionFromIntent(result.output.intent);
  const actionable = result.output.actionable ?? result.output.intent !== "none";

  return {
    intent: result.output.intent,
    metadata: {
      analysis: {
        target,
        action,
        actionable,
        confidence: result.output.confidence ?? null,
        rationale: result.output.rationale,
        evidence: result.output.evidence ?? null,
        existingArtifact: result.output.existingArtifact ?? null,
        suggestedArtifactName: result.output.suggestedArtifactName ?? null,
        suggestedChange: result.output.suggestedChange ?? null,
        model: ANALYSIS_MODEL,
        responseModel: result.response.modelId,
        finishReason: result.finishReason,
        usage: result.usage,
        inventory: {
          skillCount: inventory.skills.length,
          ruleCount: inventory.rules.length,
          warnings,
        },
        prompt: {
          path: SLACK_MESSAGE_INTENT_PROMPT_PATH,
          hash: PROMPT_HASH,
        },
      },
    },
  };
}

function targetFromIntent(intent: SlackMessageIntent): NonNullable<SlackMessageTarget> {
  if (intent.startsWith("skill.")) return "skill";
  if (intent.startsWith("rule.")) return "rule";
  return "none";
}

function actionFromIntent(intent: SlackMessageIntent): NonNullable<SlackMessageAction> {
  if (intent.endsWith(".create")) return "create";
  if (intent.endsWith(".improve")) return "improve";
  return "none";
}
