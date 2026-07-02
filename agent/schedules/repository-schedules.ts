import { defineSchedule } from "eve/schedules";

import slack from "../channels/slack.js";
import { processDueRepositorySchedules } from "#lib/schedules/schedule-dispatcher.js";

export default defineSchedule({
  cron: "* * * * *",
  run({ receive, waitUntil }) {
    waitUntil(
      (async () => {
        const result = await processDueRepositorySchedules({
          async execute(job) {
            await receive(slack, {
              message: job.message,
              target: job.target,
              auth: job.auth,
            });
          },
        });

        if (result.claimed > 0) {
          console.info("Dispatched DB-backed schedules", result);
        }
      })()
    );
  },
});
