import type { StoredSchedule } from "#lib/storage/schedules-repository.js";

export function toScheduleToolOutput(
  schedule: StoredSchedule,
  options: { includeMarkdown?: boolean } = {}
) {
  return {
    id: schedule.id,
    slug: schedule.slug,
    version: schedule.version,
    title: schedule.title,
    cron: schedule.cron,
    enabled: schedule.enabled,
    active: schedule.active,
    ownerUserId: schedule.ownerUserId,
    nextRunAt: schedule.nextRunAt,
    leaseExpiresAt: schedule.leaseExpiresAt,
    lastDispatchedAt: schedule.lastDispatchedAt,
    lastDispatchCompletedAt: schedule.lastDispatchCompletedAt,
    lastDispatchError: schedule.lastDispatchError,
    dispatchAttempts: schedule.dispatchAttempts,
    metadata: schedule.metadata,
    supersedesId: schedule.supersedesId,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    ...(options.includeMarkdown ? { markdown: schedule.markdown } : {}),
  };
}
