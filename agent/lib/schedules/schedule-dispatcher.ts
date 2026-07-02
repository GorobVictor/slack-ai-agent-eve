import {
  claimDueSchedules,
  completeScheduleDispatch,
  releaseScheduleDispatch,
  type ClaimedSchedule,
} from "#lib/storage/schedules-repository.js";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LEASE_MS = 5 * 60_000;
const DEFAULT_RETRY_MS = 5 * 60_000;

export type ScheduledSlackJob = {
  schedule: ClaimedSchedule;
  message: string;
  target: {
    channelId: string;
    threadTs?: string;
  };
  auth: {
    authenticator: "slack-webhook";
    principalId: string;
    principalType: "user";
    attributes: Record<string, string>;
  };
};

export type ProcessDueRepositorySchedulesInput = {
  now?: Date;
  limit?: number;
  leaseForMs?: number;
  retryForMs?: number;
  execute: (job: ScheduledSlackJob) => Promise<unknown>;
};

export async function processDueRepositorySchedules(input: ProcessDueRepositorySchedulesInput) {
  const now = input.now ?? new Date();
  const retryForMs = input.retryForMs ?? DEFAULT_RETRY_MS;
  const schedules = await claimDueSchedules({
    now,
    limit: input.limit ?? DEFAULT_BATCH_SIZE,
    leaseForMs: input.leaseForMs ?? DEFAULT_LEASE_MS,
  });
  let dispatched = 0;
  let released = 0;
  let failed = 0;

  for (const schedule of schedules) {
    try {
      const job = buildScheduledSlackJob(schedule);
      await input.execute(job);
      await completeScheduleDispatch(schedule);
      dispatched += 1;
    } catch (error) {
      await releaseScheduleDispatch({
        schedule,
        error,
        retryAt: new Date(Date.now() + retryForMs),
      });
      released += 1;
      if (!(error instanceof MissingScheduleSlackTargetError)) {
        failed += 1;
      }
    }
  }

  return {
    claimed: schedules.length,
    dispatched,
    released,
    failed,
  };
}

function buildScheduledSlackJob(schedule: ClaimedSchedule): ScheduledSlackJob {
  const slack = getScheduleSlackMetadata(schedule);
  const channelId = getStringValue(slack, "channelId");
  const threadTs = getStringValue(slack, "threadTs");
  const teamId = getStringValue(slack, "teamId");
  const userId = getStringValue(slack, "userId") ?? schedule.ownerUserId;

  if (!channelId) {
    throw new MissingScheduleSlackTargetError(schedule.id);
  }

  const attributes: Record<string, string> = {
    channel_id: channelId,
    thread_ts: threadTs ?? "",
    user_id: userId,
    schedule_id: schedule.id,
    schedule_slug: schedule.slug,
  };
  if (teamId) attributes.team_id = teamId;

  return {
    schedule,
    message: [
      `Run DB-backed schedule "${schedule.title}" (${schedule.slug} v${schedule.version}).`,
      "Recurring task:",
      schedule.markdown,
    ].join("\n\n"),
    target: {
      channelId,
      ...(threadTs ? { threadTs } : {}),
    },
    auth: {
      authenticator: "slack-webhook",
      principalId: userId,
      principalType: "user",
      attributes,
    },
  };
}

function getScheduleSlackMetadata(schedule: ClaimedSchedule) {
  const slack = schedule.metadata.slack;
  if (isRecord(slack)) return slack;
  return {};
}

function getStringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class MissingScheduleSlackTargetError extends Error {
  constructor(scheduleId: string) {
    super(`Schedule is missing Slack channel metadata: ${scheduleId}`);
  }
}
