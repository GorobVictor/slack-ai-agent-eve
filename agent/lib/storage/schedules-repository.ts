import { and, asc, eq, sql } from "drizzle-orm";

import { getDb } from "./db.js";
import { type Schedule, type StorageMetadata, schedules } from "./schema.js";

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
  createdAt: string;
  updatedAt: string;
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

export async function createSchedule(input: CreateScheduleInput) {
  const db = getDb();
  const now = new Date();

  const [current] = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.ownerUserId, input.ownerUserId),
        eq(schedules.slug, input.slug),
        eq(schedules.active, true)
      )
    )
    .limit(1);

  if (current) {
    throw new Error(`Active schedule already exists: ${input.slug}`);
  }

  const [created] = await db
    .insert(schedules)
    .values({
      slug: input.slug,
      version: await getNextScheduleVersion(input.ownerUserId, input.slug),
      title: input.title,
      cron: input.cron,
      markdown: input.markdown,
      enabled: true,
      active: true,
      ownerUserId: input.ownerUserId,
      metadata: input.metadata ?? {},
      updatedAt: now,
    })
    .returning();

  return serializeSchedule(created);
}

export async function upsertScheduleVersion(input: UpsertScheduleVersionInput) {
  const db = getDb();
  const now = new Date();

  const [current] = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.ownerUserId, input.ownerUserId),
        eq(schedules.slug, input.slug),
        eq(schedules.active, true)
      )
    )
    .limit(1);

  const version = await getNextScheduleVersion(input.ownerUserId, input.slug);

  if (!current) {
    const [created] = await db
      .insert(schedules)
      .values({
        slug: input.slug,
        version,
        title: input.title,
        cron: input.cron,
        markdown: input.markdown,
        enabled: true,
        active: true,
        ownerUserId: input.ownerUserId,
        metadata: input.metadata ?? {},
        updatedAt: now,
      })
      .returning();

    return serializeSchedule(created);
  }

  const created = await db.transaction(async (tx) => {
    await tx
      .update(schedules)
      .set({ active: false, enabled: false, updatedAt: now })
      .where(eq(schedules.id, current.id));

    const [nextVersion] = await tx
      .insert(schedules)
      .values({
        slug: input.slug,
        version,
        title: input.title,
        cron: input.cron,
        markdown: input.markdown,
        enabled: true,
        active: true,
        ownerUserId: input.ownerUserId,
        metadata: input.metadata ?? current.metadata,
        supersedesId: current.id,
        updatedAt: now,
      })
      .returning();

    return nextVersion;
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
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
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

function withoutUndefined(input: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
