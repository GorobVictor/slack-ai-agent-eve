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
    metadata: schedule.metadata,
    supersedesId: schedule.supersedesId,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    ...(options.includeMarkdown ? { markdown: schedule.markdown } : {}),
  };
}
