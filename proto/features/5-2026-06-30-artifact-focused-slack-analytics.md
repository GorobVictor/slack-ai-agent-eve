# Artifact-Focused Slack Analytics

## Goal

Refocus Slack message analytics from generic message categories to durable improvement signals for DB-backed Eve skills and rules.

## Context

The current analyzer classifies messages into broad categories such as `question`, `task_request`, and `feature_request`. Those labels are less useful for automatic improvement workflows because the downstream question is whether a message should create or improve a durable artifact.

Existing rules and skills already live in Neon Postgres and are accessed through the repository-backed storage layer. That storage API returns active and enabled records, which is the right context for deciding whether a message maps to a new artifact or an update to an existing one.

Schedules are intentionally out of scope until schedules have their own database schema and storage API.

## Implementation Plan

1. Replace the generic intent taxonomy in `agent/lib/analytics/slack-message-intent.ts`.
   - Use `skill.create`, `skill.improve`, `rule.create`, `rule.improve`, and `none`.
   - Keep `confidence` optional.
   - Add structured fields for target, action, actionability, evidence, existing artifact, suggested artifact name, and suggested change.

2. Add `agent/lib/analytics/artifact-inventory.ts`.
   - Load only active and enabled DB skills and rules through the existing storage repository.
   - Do not scan filesystem artifacts such as `agent/skills/`, `agent/lib/prompts/`, or `agent/schedules/`.
   - Do not include schedules yet.
   - If DB inventory loading fails, continue analysis with an empty inventory and record the warning in metadata.

3. Pass the DB-backed artifact inventory into the analyzer prompt.
   - Include compact skill/rule summaries in the JSON payload sent to the model.
   - Store inventory counts and warnings in `metadata.analysis.inventory`.

4. Rewrite `agent/lib/prompts/slack-message-intent-prompt.ts`.
   - Focus only on DB-backed skills and rules.
   - Prefer `*.improve` when the user message maps to an existing active and enabled artifact.
   - Use `*.create` only when no suitable DB artifact exists.
   - Use `none` for one-off requests, casual chat, generic questions, and all schedule-related requests for now.

5. Keep storage unchanged.
   - Continue storing the selected intent in the existing `intent` text column.
   - Store richer structured fields under `metadata.analysis`.
   - Do not generate a Drizzle migration.

## Verification

- Run `npm run typecheck`.
- Run `npm run build` because the scheduled Slack analytics processor imports this analyzer.

## Expected Outcome

Slack analytics becomes a focused queue of durable skill and rule improvement signals. Generic or schedule-related messages are still stored for history, but they are marked as `none` so future autogeneration can ignore them.
