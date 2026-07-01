# Remove Custom Rules, Keep Skills

## Goal

Remove the custom DB-backed `rules` feature while preserving DB-backed Eve skills, Slack skill discovery, and skill review candidate generation.

## Scope

- Remove custom DB/runtime `rules` support from storage, runtime instructions, Slack analytics, generation, and docs.
- Keep Eve skills in `agent/skills/` and DB-backed dynamic skills loaded through `defineDynamic` and `defineSkill`.
- Do not remove Cursor guidance in `.cursor/rules/`; those are repository workspace rules, not the runtime feature being removed.

## Implementation Plan

1. Narrow storage to skills only:
   - Remove the `rules` table and `Rule` export from `agent/lib/storage/schema.ts`.
   - Replace `agent/lib/storage/rules-skills-repository.ts` with a skill-focused repository.
   - Update runtime and analytics imports to use the skill-only repository.

2. Remove runtime rule injection:
   - Simplify `agent/instructions.ts` so it no longer loads artifact inventory or appends DB rule summaries.
   - Remove the empty `## Rules` prompt placeholder from `agent/lib/prompts/instructions-prompt.ts`.

3. Make Slack analytics skill-only:
   - Return only active skill inventory from `agent/lib/analytics/artifact-inventory.ts`.
   - Remove `rule.create` and `rule.improve` from Slack intent classification.
   - Remove rule target/result branches from Slack artifact generation and processing.
   - Claim only `skill.create` and `skill.improve` rows for artifact generation.

4. Rework migrations for a new database:
   - Rewrite existing Drizzle SQL and meta snapshots so the `rules` table never appears.
   - Remove `rules` DDL/index/FK statements from `drizzle/0000_lethal_tigra.sql`.
   - Remove the `ALTER TABLE rules ADD COLUMN review_status` statement from `drizzle/0003_illegal_obadiah_stane.sql`.
   - Update `drizzle/meta/*.json` snapshots to match the skill-only schema.

5. Clean documentation:
   - Update `README.md` and `AGENTS.md` from "rules and skills" to "skills".
   - Leave older `proto/features/` documents as historical records.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- If `.env.local` is available, recreate the database and run `npm run db:migrate` against the cleaned migration history.
