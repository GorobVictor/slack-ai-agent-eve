import { analyzeSlackMessageIntent } from "./slack-message-intent.js";
import { postSlackMessage } from "#lib/slack/api.js";
import {
  claimPendingSlackMessageAnalyses,
  completeSlackMessageAnalysis,
  failSlackMessageAnalysis,
  type StoredSlackMessageAnalysis,
} from "#lib/storage/slack-message-analytics-repository.js";

const DEFAULT_BATCH_SIZE = 10;

export async function processPendingSlackMessageAnalyses(batchSize = DEFAULT_BATCH_SIZE) {
  const messages = await claimPendingSlackMessageAnalyses(batchSize);
  let completed = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const analysis = await analyzeSlackMessageIntent(message);
      await completeSlackMessageAnalysis({
        id: message.id,
        intent: analysis.intent,
        metadata: analysis.metadata,
      });
      completed += 1;
    } catch (error) {
      const notificationMetadata = await notifySlackMessageAnalysisFailure(message);
      await failSlackMessageAnalysis({
        id: message.id,
        error,
        metadata: {
          analysisFailureNotification: notificationMetadata,
        },
      });
      failed += 1;
      console.error("Failed to analyze Slack message intent", {
        messageId: message.id,
        error,
      });
    }
  }

  return {
    claimed: messages.length,
    completed,
    failed,
  };
}

async function notifySlackMessageAnalysisFailure(message: StoredSlackMessageAnalysis) {
  try {
    const posted = await postSlackMessage({
      channelId: message.channelId,
      threadTs: message.threadTs,
      markdown:
        "I could not process this request for artifact generation. Please rephrase it or try again.",
    });

    return {
      status: "sent",
      messageTs: posted.messageTs,
    };
  } catch (error) {
    const notificationError = formatNotificationError(error);
    console.warn("Failed to post Slack message analysis failure notification", {
      messageId: message.id,
      error,
    });

    return {
      status: "failed",
      error: notificationError,
    };
  }
}

function formatNotificationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
}
