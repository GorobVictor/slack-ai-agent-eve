# Slack Message Analytics Storage

## Goal

Store every Slack `app_mention` in Postgres with the full user message, Slack identifiers, and analysis status. Intent classification should run asynchronously so Slack event handling does not wait for an additional model call.

## Context

The local Slack integration is intentionally thin. `agent/channels/slack.ts` defines `onAppMention`, where the app can access the Slack team, channel, thread, message timestamp, author, and message markdown before dispatching the main agent turn.

The storage layer already uses Neon Postgres with Drizzle ORM:

- `agent/lib/storage/schema.ts` is the Drizzle schema source of truth.
- `agent/lib/storage/db.ts` provides the shared `getDb()` helper.
- `package.json` includes `db:generate`, `db:migrate`, and `typecheck`.

Eve discovers recurring work under `agent/schedules/`, which is the expected place for an asynchronous processor.

## Implementation Plan

1. Add a `slack_message_analytics` table to `agent/lib/storage/schema.ts`.
   - Store `teamId`, `channelId`, `threadTs`, `messageTs`, `userId`, and the full `userMessage`.
   - Store `intent`, `analysisStatus`, `analysisError`, `analyzedAt`, `metadata`, and timestamps.
   - Add a unique index on `(teamId, channelId, messageTs)` to deduplicate Slack retries and serverless duplicates.
   - Add indexes for pending analysis and common analytics queries.

2. Add `agent/lib/storage/slack-message-analytics-repository.ts`.
   - `recordSlackUserMessage(input)` should insert idempotently and leave new rows in `pending`.
   - `claimPendingSlackMessageAnalyses(limit)` should atomically claim pending rows for processing.
   - `completeSlackMessageAnalysis(id, result)` should store the intent, metadata, and completion timestamp.
   - `failSlackMessageAnalysis(id, error)` should store a short failure message for retries or inspection.

3. Wire `agent/channels/slack.ts` to record incoming app mentions.
   - Persist the raw Slack message before returning `{ auth, context }`.
   - Do not wait for intent analysis.
   - Log storage failures without breaking the Slack response path.

4. Add an asynchronous pending-row processor under `agent/schedules/`.
   - Process a small batch of pending rows on each run.
   - Run structured intent analysis for each row.
   - Mark each row as completed or failed.

5. Put the intent-analysis prompt in `agent/lib/prompts/slack-message-intent-prompt.ts`.
   - Keep the prompt as an editable constant under `agent/lib/` so Eve does not ignore an unsupported agent root directory.
   - Include intent categories and structured output requirements.
   - Store prompt path and prompt hash/version in row metadata.

6. Add `agent/lib/analytics/slack-message-intent.ts`.
   - Import the editable prompt module.
   - Classify messages into `skill_improvement`, `bug_report`, `feature_request`, `question`, `task_request`, or `other`.
   - Store confidence, rationale, model, prompt path, and prompt hash in metadata.

7. Generate and review the Drizzle migration.
   - Run `npm run db:generate`.
   - Review the generated `drizzle/0002_*.sql` and metadata updates.

## Verification

- Run `npm run typecheck`.
- Run `npm run db:generate` and confirm there is no unexpected diff after the migration is generated.
- Run `npm run db:migrate` when `.env.local` has a valid `DATABASE_URL`.
- Smoke test with a Slack mention: a row should appear as `pending`, then the schedule processor should mark it `completed` with an `intent`.

## Scope Notes

- Full message text is intentionally stored for analytics quality.
- This feature covers Slack `app_mention` messages. Direct messages and interactions can be added later if needed.
- Metadata should avoid storing credentials or unrelated secrets.
