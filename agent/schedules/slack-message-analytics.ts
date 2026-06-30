import { defineSchedule } from "eve/schedules";

import { processPendingSlackMessageAnalyses } from "#lib/analytics/slack-message-analysis-processor.js";

export default defineSchedule({
  cron: "* * * * *",
  async run() {
    const result = await processPendingSlackMessageAnalyses();
    if (result.claimed > 0) {
      console.info("Processed Slack message analytics", result);
    }
  },
});
