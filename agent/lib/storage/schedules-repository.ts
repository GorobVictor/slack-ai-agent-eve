import { and, asc, eq, sql } from "drizzle-orm";

import { getNextScheduleRunAt } from "#lib/schedules/cron.js";

import { getDb } from "./db.js";
import { type Schedule, type StorageMetadata, schedules } from "./schema.js";

const MAX_DISPATCH_ERROR_LENGTH = 2_000;

export type StoredSchedule = {
  id: string;
  slug: string;
  version: number;
  title: string;
  cron: string;
  markdown: string;
  enabled: boolean;
  active: boolean;
  ownerUserId: string;
  metadata: StorageMetadata;
  supersedesId: string | null;
  nextRunAt: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  lastDispatchedAt: string | null;
  lastDispatchCompletedAt: string | null;
  lastDispatchError: string | null;
  dispatchAttempts: number;
  createdAt: string;
  updatedAt: string;
};

export type ClaimedSchedule = StoredSchedule & {
  leaseToken: string;
  leaseExpiresAt: string;
};

export type CreateScheduleInput = {
  slug: string;
  title: string;
  cron: string;
  markdown: string;
  ownerUserId: string;
  metadata?: StorageMetadata;
};

export type UpsertScheduleVersionInput = CreateScheduleInput;

export type GetActiveSchedulesInput = {
  ownerUserId?: string;
  slug?: string;
  limit?: number;
};

export type SoftDeleteScheduleInput = {
  id: string;
  requesterUserId: string;
  isAdmin?: boolean;
  reason?: string;
};

export type ClaimDueSchedulesInput = {
  now?: Date;
  limit?: number;
  leaseForMs: number;
};

export type ReleaseScheduleDispatchInput = {
  schedule: ClaimedSchedule;
  error: unknown;
  retryAt: Date;
};

type RawScheduleRow = Omit<
  StoredSchedule,
  | "nextRunAt"
  | "leaseExpiresAt"
  | "lastDispatchedAt"
  | "lastDispatchCompletedAt"
  | "createdAt"
  | "updatedAt"
> & {
  nextRunAt: Date | string | null;
  leaseExpiresAt: Date | string | null;
  lastDispatchedAt: Date | string | null;
  lastDispatchCompletedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function createSchedule(input: CreateScheduleInput) {
  const now = new Date();
  const nextRunAt = getNextScheduleRunAt(input.cron, now);
  const current = await getActiveSchedule(input.ownerUserId, input.slug);

  if (current) {
    throw new Error(`Active schedule already exists: ${input.slug}`);
  }

  const created = await insertScheduleVersion({
    schedule: input,
    version: await getNextScheduleVersion(input.ownerUserId, input.slug),
    metadata: input.metadata ?? {},
    nextRunAt,
    updatedAt: now,
  });

  return serializeSchedule(created);
}

export async function upsertScheduleVersion(input: UpsertScheduleVersionInput) {
  const db = getDb();
  const now = new Date();
  const nextRunAt = getNextScheduleRunAt(input.cron, now);
  const current = await getActiveSchedule(input.ownerUserId, input.slug);

  const version = await getNextScheduleVersion(input.ownerUserId, input.slug);

  if (!current) {
    const created = await insertScheduleVersion({
      schedule: input,
      version,
      metadata: input.metadata ?? {},
      nextRunAt,
      updatedAt: now,
    });

    return serializeSchedule(created);
  }

  await db
    .update(schedules)
    .set({ active: false, enabled: false, updatedAt: now })
    .where(eq(schedules.id, current.id));

  const created = await insertScheduleVersion({
    schedule: input,
    version,
    metadata: input.metadata ?? current.metadata,
    supersedesId: current.id,
    nextRunAt,
    updatedAt: now,
  });

  return serializeSchedule(created);
}

export async function getActiveSchedules(input: GetActiveSchedulesInput = {}) {
  const where = [eq(schedules.enabled, true), eq(schedules.active, true)];
  if (input.ownerUserId) where.push(eq(schedules.ownerUserId, input.ownerUserId));
  if (input.slug) where.push(eq(schedules.slug, input.slug));

  const rows = await getDb()
    .select()
    .from(schedules)
    .where(and(...where))
    .orderBy(asc(schedules.ownerUserId), asc(schedules.slug))
    .limit(input.limit ?? 50);

  return rows.map(serializeSchedule);
}

export async function claimDueSchedules(input: ClaimDueSchedulesInput) {
  const safeLimit = Math.max(1, Math.min(input.limit ?? 10, 50));
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + input.leaseForMs);

  const result = await getDb().execute<RawScheduleRow>(sql`
    with claimed as (
      select id
      from ${schedules}
      where enabled = true
        and active = true
        and next_run_at is not null
        and next_run_at <= ${now}
        and (
          lease_token is null
          or lease_expires_at is null
          or lease_expires_at <= ${now}
        )
      order by next_run_at asc, owner_user_id asc, slug asc
      limit ${safeLimit}
      for update skip locked
    )
    update ${schedules}
    set
      lease_token = gen_random_uuid()::text,
      lease_expires_at = ${leaseExpiresAt},
      last_dispatched_at = ${now},
      last_dispatch_error = null,
      dispatch_attempts = dispatch_attempts + 1,
      updated_at = ${now}
    where id in (select id from claimed)
    returning
      id,
      slug,
      version,
      title,
      cron,
      markdown,
      enabled,
      active,
      owner_user_id as "ownerUserId",
      metadata,
      supersedes_id as "supersedesId",
      next_run_at as "nextRunAt",
      lease_token as "leaseToken",
      lease_expires_at as "leaseExpiresAt",
      last_dispatched_at as "lastDispatchedAt",
      last_dispatch_completed_at as "lastDispatchCompletedAt",
      last_dispatch_error as "lastDispatchError",
      dispatch_attempts as "dispatchAttempts",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);

  return result.rows.map(serializeRawClaimedSchedule);
}

export async function completeScheduleDispatch(schedule: ClaimedSchedule, completedAt = new Date()) {
  const nextRunAt = getNextScheduleRunAt(schedule.cron, completedAt);
  const [updated] = await getDb()
    .update(schedules)
    .set({
      nextRunAt,
      leaseToken: null,
      leaseExpiresAt: null,
      lastDispatchCompletedAt: completedAt,
      lastDispatchError: null,
      updatedAt: completedAt,
    })
    .where(and(eq(schedules.id, schedule.id), eq(schedules.leaseToken, schedule.leaseToken)))
    .returning();

  return updated ? serializeSchedule(updated) : null;
}

export async function releaseScheduleDispatch(input: ReleaseScheduleDispatchInput) {
  const now = new Date();
  const [updated] = await getDb()
    .update(schedules)
    .set({
      nextRunAt: input.retryAt,
      leaseToken: null,
      leaseExpiresAt: null,
      lastDispatchError: formatDispatchError(input.error),
      updatedAt: now,
    })
    .where(
      and(eq(schedules.id, input.schedule.id), eq(schedules.leaseToken, input.schedule.leaseToken))
    )
    .returning();

  return updated ? serializeSchedule(updated) : null;
}

export async function softDeleteSchedule(input: SoftDeleteScheduleInput) {
  const db = getDb();
  const now = new Date();
  const [schedule] = await db.select().from(schedules).where(eq(schedules.id, input.id)).limit(1);

  if (!schedule) {
    throw new Error(`Schedule not found: ${input.id}`);
  }

  if (!input.isAdmin && schedule.ownerUserId !== input.requesterUserId) {
    throw new Error("Only the schedule owner or an admin can delete this schedule");
  }

  const [updated] = await db
    .update(schedules)
    .set({
      enabled: false,
      active: false,
      nextRunAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
      metadata: withLifecycleMetadata(schedule.metadata, {
        deletedAt: now.toISOString(),
        deletedBy: input.requesterUserId,
        deleteReason: input.reason,
      }),
      updatedAt: now,
    })
    .where(eq(schedules.id, schedule.id))
    .returning();

  return serializeSchedule(updated);
}

async function getNextScheduleVersion(ownerUserId: string, slug: string) {
  const [row] = await getDb()
    .select({ nextVersion: sql<number>`coalesce(max(${schedules.version}), 0) + 1` })
    .from(schedules)
    .where(and(eq(schedules.ownerUserId, ownerUserId), eq(schedules.slug, slug)));

  return Number(row?.nextVersion ?? 1);
}

async function getActiveSchedule(ownerUserId: string, slug: string) {
  const [schedule] = await getDb()
    .select()
    .from(schedules)
    .where(and(eq(schedules.ownerUserId, ownerUserId), eq(schedules.slug, slug), eq(schedules.active, true)))
    .limit(1);

  return schedule;
}

async function insertScheduleVersion(input: {
  schedule: CreateScheduleInput;
  version: number;
  metadata: StorageMetadata;
  supersedesId?: string;
  nextRunAt: Date;
  updatedAt: Date;
}) {
  const [created] = await getDb().insert(schedules).values(buildScheduleInsertValues(input)).returning();
  return created;
}

function serializeSchedule(schedule: Schedule): StoredSchedule {
  return {
    id: schedule.id,
    slug: schedule.slug,
    version: schedule.version,
    title: schedule.title,
    cron: schedule.cron,
    markdown: schedule.markdown,
    enabled: schedule.enabled,
    active: schedule.active,
    ownerUserId: schedule.ownerUserId,
    metadata: schedule.metadata,
    supersedesId: schedule.supersedesId,
    nextRunAt: toIsoStringOrNull(schedule.nextRunAt),
    leaseToken: schedule.leaseToken,
    leaseExpiresAt: toIsoStringOrNull(schedule.leaseExpiresAt),
    lastDispatchedAt: toIsoStringOrNull(schedule.lastDispatchedAt),
    lastDispatchCompletedAt: toIsoStringOrNull(schedule.lastDispatchCompletedAt),
    lastDispatchError: schedule.lastDispatchError,
    dispatchAttempts: schedule.dispatchAttempts,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

function serializeRawClaimedSchedule(row: RawScheduleRow): ClaimedSchedule {
  const schedule = serializeRawSchedule(row);
  if (!schedule.leaseToken || !schedule.leaseExpiresAt) {
    throw new Error(`Claimed schedule is missing lease data: ${schedule.id}`);
  }

  return {
    ...schedule,
    leaseToken: schedule.leaseToken,
    leaseExpiresAt: schedule.leaseExpiresAt,
  };
}

function serializeRawSchedule(row: RawScheduleRow): StoredSchedule {
  return {
    id: row.id,
    slug: row.slug,
    version: row.version,
    title: row.title,
    cron: row.cron,
    markdown: row.markdown,
    enabled: row.enabled,
    active: row.active,
    ownerUserId: row.ownerUserId,
    metadata: row.metadata,
    supersedesId: row.supersedesId,
    nextRunAt: toIsoStringOrNull(row.nextRunAt),
    leaseToken: row.leaseToken,
    leaseExpiresAt: toIsoStringOrNull(row.leaseExpiresAt),
    lastDispatchedAt: toIsoStringOrNull(row.lastDispatchedAt),
    lastDispatchCompletedAt: toIsoStringOrNull(row.lastDispatchCompletedAt),
    lastDispatchError: row.lastDispatchError,
    dispatchAttempts: row.dispatchAttempts,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function withLifecycleMetadata(
  metadata: StorageMetadata,
  lifecycleUpdate: Record<string, string | undefined>
) {
  return {
    ...metadata,
    lifecycle: {
      ...(isRecord(metadata.lifecycle) ? metadata.lifecycle : {}),
      ...withoutUndefined(lifecycleUpdate),
    },
  };
}

function buildScheduleInsertValues(input: {
  schedule: CreateScheduleInput;
  version: number;
  metadata: StorageMetadata;
  supersedesId?: string;
  nextRunAt: Date;
  updatedAt: Date;
}) {
  return {
    slug: input.schedule.slug,
    version: input.version,
    title: input.schedule.title,
    cron: input.schedule.cron,
    markdown: input.schedule.markdown,
    enabled: true,
    active: true,
    ownerUserId: input.schedule.ownerUserId,
    metadata: input.metadata,
    supersedesId: input.supersedesId,
    nextRunAt: input.nextRunAt,
    updatedAt: input.updatedAt,
  };
}

function toIsoStringOrNull(value: Date | string | null) {
  if (!value) return null;
  return toIsoString(value);
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatDispatchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_DISPATCH_ERROR_LENGTH);
}

function withoutUndefined(input: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
