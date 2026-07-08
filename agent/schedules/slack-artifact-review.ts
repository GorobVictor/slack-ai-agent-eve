import { defineSchedule } from "eve/schedules";

import { processPendingSlackArtifactGenerations } from "#lib/analytics/slack-artifact-generation-processor.js";

export default defineSchedule({
  cron: "*/2 * * * *",
  async run() {
    const result = await processPendingSlackArtifactGenerations();
    if (result.claimed > 0) {
      console.info("Processed Slack artifact review candidates", result);
    }
  },
});
