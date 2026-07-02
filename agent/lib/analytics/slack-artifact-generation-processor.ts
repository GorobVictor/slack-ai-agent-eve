import { generateSlackArtifactCandidate } from "./slack-artifact-generation.js";
import { postSlackMessage } from "#lib/slack/api.js";
import { createSkillReviewCandidate } from "#lib/storage/skills-repository.js";
import { createSchedule, upsertScheduleVersion } from "#lib/storage/schedules-repository.js";
import {
  claimPendingSlackArtifactGenerations,
  completeSlackArtifactGeneration,
  failSlackArtifactGeneration,
  type StoredSlackMessageAnalysis,
} from "#lib/storage/slack-message-analytics-repository.js";
import type { StorageMetadata } from "#lib/storage/schema.js";

const DEFAULT_BATCH_SIZE = 5;

export async function processPendingSlackArtifactGenerations(batchSize = DEFAULT_BATCH_SIZE) {
  const messages = await claimPendingSlackArtifactGenerations(batchSize);
  let reviewed = 0;
  let skipped = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const result = await generateSlackArtifactCandidate(message);

      if (result.status === "skip") {
        await completeSlackArtifactGeneration({
          id: message.id,
          status: "skipped",
          metadata: {
            artifactGeneration: {
              status: "skipped",
              reason: result.reason,
            },
            ...result.metadata,
          },
        });
        skipped += 1;
        continue;
      }

      const metadata = buildCandidateMetadata(message, result.metadata);
      const artifactGenerationMetadata =
        result.target === "skill"
          ? await createSkillArtifactGenerationMetadata(result, metadata)
          : await createScheduleArtifactGenerationMetadata(message, result, metadata);
      const notificationMetadata = await notifyArtifactGenerationSuccess(message, artifactGenerationMetadata);

      await completeSlackArtifactGeneration({
        id: message.id,
        status: "review",
        metadata: {
          artifactGeneration: {
            ...artifactGenerationMetadata,
            ...notificationMetadata,
          },
          ...result.metadata,
        },
      });
      reviewed += 1;
    } catch (error) {
      await failSlackArtifactGeneration(message.id, error);
      failed += 1;
      console.error("Failed to generate Slack artifact review candidate", {
        messageId: message.id,
        error,
      });
    }
  }

  return {
    claimed: messages.length,
    reviewed,
    skipped,
    failed,
  };
}

async function createSkillArtifactGenerationMetadata(
  result: Extract<Awaited<ReturnType<typeof generateSlackArtifactCandidate>>, { target: "skill" }>,
  metadata: StorageMetadata
) {
  const artifact = await createSkillReviewCandidate({
    ...result.artifact,
    metadata,
  });

  return {
    status: "review",
    target: result.target,
    artifactId: artifact.id,
    slug: artifact.slug,
    title: artifact.title,
    version: artifact.version,
  };
}

async function createScheduleArtifactGenerationMetadata(
  message: StoredSlackMessageAnalysis,
  result: Extract<Awaited<ReturnType<typeof generateSlackArtifactCandidate>>, { target: "schedule" }>,
  metadata: StorageMetadata
) {
  const artifact = await createOrImproveSchedule(message, result.artifact, metadata);

  return {
    status: "review",
    target: result.target,
    artifactId: artifact.id,
    slug: artifact.slug,
    title: artifact.title,
    version: artifact.version,
    cron: artifact.cron,
  };
}

async function notifyArtifactGenerationSuccess(
  message: StoredSlackMessageAnalysis,
  artifact: {
    target: "skill" | "schedule";
    slug: string;
    title: string;
    version: number;
    cron?: string;
  }
) {
  const markdown = buildArtifactNotificationMessage(message, artifact);

  try {
    const posted = await postSlackMessage({
      channelId: message.channelId,
      threadTs: message.threadTs,
      markdown,
    });

    return {
      notificationStatus: "sent",
      notificationMessageTs: posted.messageTs,
    };
  } catch (error) {
    const notificationError = formatNotificationError(error);
    console.warn("Failed to post Slack artifact generation notification", {
      messageId: message.id,
      target: artifact.target,
      slug: artifact.slug,
      error,
    });

    return {
      notificationStatus: "failed",
      notificationError,
    };
  }
}

function buildArtifactNotificationMessage(
  message: StoredSlackMessageAnalysis,
  artifact: {
    target: "skill" | "schedule";
    slug: string;
    title: string;
    version: number;
    cron?: string;
  }
) {
  const name = artifact.title || artifact.slug;

  if (artifact.target === "skill") {
    return `Created a skill review candidate: ${name} v${artifact.version}.`;
  }

  if (message.intent === "schedule.improve") {
    return `Updated schedule: ${name} to v${artifact.version} (${artifact.cron}).`;
  }

  return `Created schedule: ${name} v${artifact.version} (${artifact.cron}).`;
}

async function createOrImproveSchedule(
  message: StoredSlackMessageAnalysis,
  artifact: {
    slug: string;
    title: string;
    cron: string;
    markdown: string;
  },
  metadata: StorageMetadata
) {
  const input = {
    ...artifact,
    ownerUserId: message.userId,
    metadata,
  };

  if (message.intent === "schedule.improve") {
    return upsertScheduleVersion(input);
  }

  return createSchedule(input);
}

function buildCandidateMetadata(
  message: StoredSlackMessageAnalysis,
  generationMetadata: StorageMetadata
): StorageMetadata {
  const analysis = getAnalysisMetadata(message.metadata);

  return {
    source: "slack_message_analytics",
    review: {
      status: "review",
    },
    analyticsId: message.id,
    intent: message.intent,
    analysis: {
      confidence: getMetadataValue(analysis, "confidence"),
      evidence: getMetadataValue(analysis, "evidence"),
      rationale: getMetadataValue(analysis, "rationale"),
      suggestedArtifactName: getMetadataValue(analysis, "suggestedArtifactName"),
      suggestedChange: getMetadataValue(analysis, "suggestedChange"),
    },
    slack: {
      teamId: message.teamId,
      channelId: message.channelId,
      threadTs: message.threadTs,
      messageTs: message.messageTs,
      userId: message.userId,
    },
    ...generationMetadata,
  };
}

function getAnalysisMetadata(metadata: StorageMetadata) {
  const analysis = metadata.analysis;
  return typeof analysis === "object" && analysis !== null ? analysis : null;
}

function getMetadataValue(metadata: object | null, key: string) {
  if (!metadata || !(key in metadata)) return null;
  return (metadata as Record<string, unknown>)[key] ?? null;
}

function formatNotificationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
}
