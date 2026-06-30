import { analyzeSlackMessageIntent } from "./slack-message-intent.js";
import {
  claimPendingSlackMessageAnalyses,
  completeSlackMessageAnalysis,
  failSlackMessageAnalysis,
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
      await failSlackMessageAnalysis(message.id, error);
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
