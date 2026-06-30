import { generateSlackArtifactCandidate } from "./slack-artifact-generation.js";
import {
  createRuleReviewCandidate,
  createSkillReviewCandidate,
  type StoredRule,
  type StoredSkill,
} from "#lib/storage/rules-skills-repository.js";
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

      const artifact =
        result.target === "skill"
          ? await createSkillReviewCandidate({
              ...result.artifact,
              metadata: buildCandidateMetadata(message, result.metadata),
            })
          : await createRuleReviewCandidate({
              ...result.artifact,
              metadata: buildCandidateMetadata(message, result.metadata),
            });

      await completeSlackArtifactGeneration({
        id: message.id,
        status: "review",
        metadata: {
          artifactGeneration: {
            status: "review",
            target: result.target,
            artifactId: artifact.id,
            slug: artifact.slug,
            version: artifact.version,
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
