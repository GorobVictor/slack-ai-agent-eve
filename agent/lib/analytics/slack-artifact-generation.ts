import { createHash } from "node:crypto";

import { generateText, Output } from "ai";
import { z } from "zod";

import { loadArtifactInventory } from "./artifact-inventory.js";
import {
  SLACK_ARTIFACT_GENERATION_PROMPT,
  SLACK_ARTIFACT_GENERATION_PROMPT_PATH,
} from "#lib/prompts/slack-artifact-generation-prompt.js";
import { loadSlackThreadHistory } from "#lib/slack/thread-history.js";
import type { StoredSlackMessageAnalysis } from "#lib/storage/slack-message-analytics-repository.js";
import type { StorageMetadata } from "#lib/storage/schema.js";

const GENERATION_MODEL =
  process.env.SLACK_ARTIFACT_GENERATION_MODEL ??
  process.env.SLACK_MESSAGE_ANALYSIS_MODEL ??
  "google/gemma-4-31b-it";
const PROMPT_HASH = createHash("sha256").update(SLACK_ARTIFACT_GENERATION_PROMPT).digest("hex");
const MAX_SLUG_LENGTH = 80;

const generationSchema = z.object({
  result: z
    .string()
    .nullable()
    .optional()
    .describe("Whether a concrete review candidate can be generated."),
  target: z.string().nullable().optional().describe("The artifact type for a candidate."),
  type: z.string().nullable().optional().describe("Alias for target, accepted for model compatibility."),
  slug: z.string().nullable().optional().describe("Lowercase kebab-case artifact slug."),
  title: z.string().nullable().optional().describe("Human-readable artifact title."),
  description: z.string().nullable().optional().describe("Skill description."),
  content: z.string().nullable().optional().describe("Full markdown content for the generated artifact."),
  cron: z.string().nullable().optional().describe("Five-field cron expression for a generated schedule."),
  markdown: z
    .string()
    .nullable()
    .optional()
    .describe("Full markdown prompt for a generated schedule."),
  confidence: z.union([z.number(), z.string()]).nullable().optional(),
  reason: z.string().max(500).nullable().optional().describe("Short explanation for generation or skip."),
});

export type SlackArtifactGenerationResult =
  | {
      status: "candidate";
      target: "skill";
      artifact: {
        slug: string;
        title: string;
        description: string | null;
        content: string;
      };
      metadata: StorageMetadata;
    }
  | {
      status: "candidate";
      target: "schedule";
      artifact: {
        slug: string;
        title: string;
        cron: string;
        markdown: string;
      };
      metadata: StorageMetadata;
    }
  | {
      status: "skip";
      reason: string;
      metadata: StorageMetadata;
    };

export async function generateSlackArtifactCandidate(
  message: StoredSlackMessageAnalysis
): Promise<SlackArtifactGenerationResult> {
  const { inventory, warnings } = await loadArtifactInventory({
    scheduleOwnerUserId: message.userId,
  });
  const threadHistory = await loadSlackThreadHistory({
    channelId: message.channelId,
    threadTs: message.threadTs,
    messageTs: message.messageTs,
  });
  const target = targetFromIntent(message.intent);

  if (!target) {
    return buildSkipResult("The analytics row does not target a supported artifact.", null, warnings);
  }

  const result = await generateText({
    model: GENERATION_MODEL,
    output: Output.object({
      name: "SlackArtifactGeneration",
      description: "A generated candidate for one DB-backed Eve artifact.",
      schema: generationSchema,
    }),
    prompt: [
      SLACK_ARTIFACT_GENERATION_PROMPT,
      "",
      "Required target:",
      target,
      "",
      "Slack analytics row:",
      JSON.stringify(
        {
          id: message.id,
          teamId: message.teamId,
          channelId: message.channelId,
          threadTs: message.threadTs,
          messageTs: message.messageTs,
          userId: message.userId,
          userMessage: message.userMessage,
          intent: message.intent,
          analysis: getAnalysisMetadata(message.metadata),
        },
        null,
        2
      ),
      "",
      "Slack thread history:",
      threadHistory.transcript || "No Slack thread history was available.",
      "",
      "Existing active and enabled DB artifacts:",
      JSON.stringify(inventory, null, 2),
    ].join("\n"),
  });

  const generationMetadata = {
    generation: {
      model: GENERATION_MODEL,
      responseModel: result.response.modelId,
      finishReason: result.finishReason,
      usage: result.usage,
      confidence: normalizeConfidence(result.output.confidence),
      reason: result.output.reason ?? null,
      inventory: {
        skillCount: inventory.skills.length,
        scheduleCount: inventory.schedules.length,
        warnings,
      },
      slackThreadHistory: {
        messageCount: threadHistory.messageCount,
        includedMessageCount: threadHistory.messages.length,
        truncated: threadHistory.truncated,
        warnings: threadHistory.warnings,
      },
      prompt: {
        path: SLACK_ARTIFACT_GENERATION_PROMPT_PATH,
        hash: PROMPT_HASH,
      },
    },
  };

  const outputTarget = normalizeTarget(result.output.target ?? result.output.type);
  const outputResult =
    normalizeResult(result.output.result) ??
    (result.output.content || result.output.markdown || result.output.cron ? "candidate" : "skip");
  const reason = result.output.reason ?? "Generated from a completed Slack analytics row.";

  if (outputResult === "skip") {
    return {
      status: "skip",
      reason,
      metadata: generationMetadata,
    };
  }

  if (outputTarget && outputTarget !== target) {
    return buildSkipResult(
      `Generated target ${String(outputTarget)} did not match required target ${target}.`,
      generationMetadata,
      warnings
    );
  }

  const slug = normalizeSlug(result.output.slug);
  const title = result.output.title?.trim() || titleFromSlug(slug);
  const content = result.output.content?.trim();
  const cron = result.output.cron?.trim();
  const markdown = result.output.markdown?.trim();

  if (target === "schedule") {
    if (message.intent === "schedule.improve" && !inventory.schedules.some((item) => item.slug === slug)) {
      return buildSkipResult(
        "The generated schedule improvement did not match an active schedule.",
        generationMetadata,
        warnings
      );
    }

    if (!slug || !title || !cron || !markdown || !isFiveFieldCron(cron)) {
      return buildSkipResult(
        "The generated schedule was missing a slug, title, cron, or markdown.",
        generationMetadata,
        warnings
      );
    }

    return {
      status: "candidate",
      target,
      artifact: {
        slug,
        title,
        cron,
        markdown,
      },
      metadata: generationMetadata,
    };
  }

  if (!slug || !title || !content) {
    return buildSkipResult(
      "The generated candidate was missing a slug, title, or content.",
      generationMetadata,
      warnings
    );
  }

  return {
    status: "candidate",
    target,
    artifact: {
      slug,
      title,
      description: result.output.description?.trim() || null,
      content,
    },
    metadata: generationMetadata,
  };
}

function targetFromIntent(intent: string | null) {
  if (intent?.startsWith("skill.")) return "skill" as const;
  if (intent?.startsWith("schedule.")) return "schedule" as const;
  return null;
}

function normalizeTarget(value: string | null | undefined) {
  const normalized = value?.toLowerCase().trim();
  if (normalized === "skill" || normalized === "skills") return "skill" as const;
  if (normalized === "schedule" || normalized === "schedules") return "schedule" as const;
  return null;
}

function normalizeResult(value: string | null | undefined) {
  const normalized = value?.toLowerCase().trim();
  if (normalized === "candidate" || normalized === "review") return "candidate" as const;
  if (normalized === "skip" || normalized === "skipped") return "skip" as const;
  return null;
}

function normalizeConfidence(value: number | string | null | undefined) {
  if (typeof value === "number") return Math.max(0, Math.min(value, 1));
  if (typeof value !== "string") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1)) : null;
}

function normalizeSlug(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH) ?? ""
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isFiveFieldCron(value: string) {
  return value.trim().split(/\s+/).length === 5;
}

function getAnalysisMetadata(metadata: StorageMetadata) {
  const analysis = metadata.analysis;
  return typeof analysis === "object" && analysis !== null ? analysis : null;
}

function buildSkipResult(
  reason: string,
  metadata: StorageMetadata | null,
  warnings: string[]
): SlackArtifactGenerationResult {
  return {
    status: "skip",
    reason,
    metadata:
      metadata ?? {
        generation: {
          model: GENERATION_MODEL,
          reason,
          inventory: {
            warnings,
          },
          prompt: {
            path: SLACK_ARTIFACT_GENERATION_PROMPT_PATH,
            hash: PROMPT_HASH,
          },
        },
      },
  };
}
