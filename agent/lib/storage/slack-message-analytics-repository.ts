import { eq, sql } from "drizzle-orm";

import { getDb } from "./db.js";
import {
  type SlackArtifactGenerationStatus,
  type SlackMessageAnalytics,
  type SlackMessageAnalysisStatus,
  type StorageMetadata,
  slackMessageAnalytics,
} from "./schema.js";

export type StoredSlackMessageAnalysis = {
  id: string;
  teamId: string;
  channelId: string;
  threadTs: string;
  messageTs: string;
  userId: string;
  userMessage: string;
  intent: string | null;
  analysisStatus: SlackMessageAnalysisStatus;
  analysisError: string | null;
  analyzedAt: string | null;
  artifactGenerationStatus: SlackArtifactGenerationStatus;
  artifactGenerationError: string | null;
  artifactGeneratedAt: string | null;
  metadata: StorageMetadata;
  createdAt: string;
  updatedAt: string;
};

export type RecordSlackUserMessageInput = {
  teamId: string;
  channelId: string;
  threadTs: string;
  messageTs: string;
  userId: string;
  userMessage: string;
  metadata?: StorageMetadata;
};

export type CompleteSlackMessageAnalysisInput = {
  id: string;
  intent: string;
  metadata?: StorageMetadata;
};

export type CompleteSlackArtifactGenerationInput = {
  id: string;
  status: Extract<SlackArtifactGenerationStatus, "review" | "skipped">;
  metadata?: StorageMetadata;
};

export type FailSlackMessageAnalysisInput = {
  id: string;
  error: unknown;
  metadata?: StorageMetadata;
};

const MAX_ERROR_LENGTH = 2_000;

type RawSlackMessageAnalysisRow = Omit<
  StoredSlackMessageAnalysis,
  "analyzedAt" | "artifactGeneratedAt" | "createdAt" | "updatedAt"
> & {
  analyzedAt: Date | string | null;
  artifactGeneratedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function recordSlackUserMessage(input: RecordSlackUserMessageInput) {
  const now = new Date();
  const [row] = await getDb()
    .insert(slackMessageAnalytics)
    .values({
      teamId: input.teamId,
      channelId: input.channelId,
      threadTs: input.threadTs,
      messageTs: input.messageTs,
      userId: input.userId,
      userMessage: input.userMessage,
      metadata: input.metadata ?? {},
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        slackMessageAnalytics.teamId,
        slackMessageAnalytics.channelId,
        slackMessageAnalytics.messageTs,
      ],
      set: {
        threadTs: input.threadTs,
        userId: input.userId,
        userMessage: input.userMessage,
        metadata: mergeMetadata(input.metadata),
        updatedAt: now,
      },
    })
    .returning();

  return serializeSlackMessageAnalysis(row);
}

export async function claimPendingSlackMessageAnalyses(limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const now = new Date();

  const result = await getDb().execute<RawSlackMessageAnalysisRow>(sql`
    with claimed as (
      select id
      from ${slackMessageAnalytics}
      where analysis_status = 'pending'
      order by created_at asc
      limit ${safeLimit}
      for update skip locked
    )
    update ${slackMessageAnalytics}
    set
      analysis_status = 'processing',
      analysis_error = null,
      updated_at = ${now}
    where id in (select id from claimed)
    returning
      id,
      team_id as "teamId",
      channel_id as "channelId",
      thread_ts as "threadTs",
      message_ts as "messageTs",
      user_id as "userId",
      user_message as "userMessage",
      intent,
      analysis_status as "analysisStatus",
      analysis_error as "analysisError",
      analyzed_at as "analyzedAt",
      artifact_generation_status as "artifactGenerationStatus",
      artifact_generation_error as "artifactGenerationError",
      artifact_generated_at as "artifactGeneratedAt",
      metadata,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);

  return result.rows.map(serializeRawSlackMessageAnalysis);
}

export async function completeSlackMessageAnalysis(input: CompleteSlackMessageAnalysisInput) {
  const now = new Date();
  const [row] = await getDb()
    .update(slackMessageAnalytics)
    .set({
      intent: input.intent,
      analysisStatus: "completed",
      analysisError: null,
      analyzedAt: now,
      metadata: mergeMetadata(input.metadata),
      updatedAt: now,
    })
    .where(eq(slackMessageAnalytics.id, input.id))
    .returning();

  return row ? serializeSlackMessageAnalysis(row) : null;
}

export async function claimPendingSlackArtifactGenerations(limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const now = new Date();

  const result = await getDb().execute<RawSlackMessageAnalysisRow>(sql`
    with claimed as (
      select id
      from ${slackMessageAnalytics}
      where analysis_status = 'completed'
        and artifact_generation_status = 'pending'
        and intent in ('skill.create', 'skill.improve', 'schedule.create', 'schedule.improve')
      order by analyzed_at asc nulls last, created_at asc
      limit ${safeLimit}
      for update skip locked
    )
    update ${slackMessageAnalytics}
    set
      artifact_generation_status = 'processing',
      artifact_generation_error = null,
      updated_at = ${now}
    where id in (select id from claimed)
    returning
      id,
      team_id as "teamId",
      channel_id as "channelId",
      thread_ts as "threadTs",
      message_ts as "messageTs",
      user_id as "userId",
      user_message as "userMessage",
      intent,
      analysis_status as "analysisStatus",
      analysis_error as "analysisError",
      analyzed_at as "analyzedAt",
      artifact_generation_status as "artifactGenerationStatus",
      artifact_generation_error as "artifactGenerationError",
      artifact_generated_at as "artifactGeneratedAt",
      metadata,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);

  return result.rows.map(serializeRawSlackMessageAnalysis);
}

export async function completeSlackArtifactGeneration(
  input: CompleteSlackArtifactGenerationInput
) {
  const now = new Date();
  const [row] = await getDb()
    .update(slackMessageAnalytics)
    .set({
      artifactGenerationStatus: input.status,
      artifactGenerationError: null,
      artifactGeneratedAt: now,
      metadata: mergeMetadata(input.metadata),
      updatedAt: now,
    })
    .where(eq(slackMessageAnalytics.id, input.id))
    .returning();

  return row ? serializeSlackMessageAnalysis(row) : null;
}

export async function failSlackArtifactGeneration(id: string, error: unknown) {
  const now = new Date();
  const [row] = await getDb()
    .update(slackMessageAnalytics)
    .set({
      artifactGenerationStatus: "failed",
      artifactGenerationError: formatAnalysisError(error),
      updatedAt: now,
    })
    .where(eq(slackMessageAnalytics.id, id))
    .returning();

  return row ? serializeSlackMessageAnalysis(row) : null;
}

export async function failSlackMessageAnalysis(input: FailSlackMessageAnalysisInput) {
  const now = new Date();
  const [row] = await getDb()
    .update(slackMessageAnalytics)
    .set({
      analysisStatus: "failed",
      analysisError: formatAnalysisError(input.error),
      metadata: mergeMetadata(input.metadata),
      updatedAt: now,
    })
    .where(eq(slackMessageAnalytics.id, input.id))
    .returning();

  return row ? serializeSlackMessageAnalysis(row) : null;
}

function serializeSlackMessageAnalysis(row: SlackMessageAnalytics): StoredSlackMessageAnalysis {
  return {
    id: row.id,
    teamId: row.teamId,
    channelId: row.channelId,
    threadTs: row.threadTs,
    messageTs: row.messageTs,
    userId: row.userId,
    userMessage: row.userMessage,
    intent: row.intent,
    analysisStatus: row.analysisStatus,
    analysisError: row.analysisError,
    analyzedAt: row.analyzedAt?.toISOString() ?? null,
    artifactGenerationStatus: row.artifactGenerationStatus,
    artifactGenerationError: row.artifactGenerationError,
    artifactGeneratedAt: row.artifactGeneratedAt?.toISOString() ?? null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRawSlackMessageAnalysis(row: RawSlackMessageAnalysisRow): StoredSlackMessageAnalysis {
  return {
    ...row,
    analyzedAt: row.analyzedAt ? new Date(row.analyzedAt).toISOString() : null,
    artifactGeneratedAt: row.artifactGeneratedAt
      ? new Date(row.artifactGeneratedAt).toISOString()
      : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function formatAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

function mergeMetadata(metadata?: StorageMetadata) {
  return sql`${slackMessageAnalytics.metadata} || ${metadata ?? {}}::jsonb`;
}
